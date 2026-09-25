"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { WebGLRenderer } from "three";
import {
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene as ThreeScene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from "three";

/**
 * What happens to the picture after the scene is drawn.
 *
 * Four passes, and the first one is the reason the rest are affordable: the
 * scene is rendered into a buffer whose size is capped, rather than into
 * whatever enormous backing store a retina display asks for. On a wide screen
 * at device pixel ratio two that is four megapixels of shading saved every
 * frame, which is most of the difference between sixty and thirty.
 *
 * Then the bright parts are pulled out, blurred twice at a quarter of that
 * again, and added back. Bloom is doing the heavy lifting here: this scene is
 * a dark room with hot filaments, a gold ring and a glowing burst in it, and
 * light that spills past its own edges is most of what separates a lit scene
 * from a flat one.
 *
 * The last pass also does the colour work — a filmic shoulder so the lamps roll
 * off instead of clipping to white, a warm lift, a soft vignette — and the
 * conversion into the space a screen expects. That conversion has to be here:
 * three only applies it when drawing straight to the canvas, and anything that
 * renders through a buffer first has to do it by hand or the whole picture
 * comes out several stops dark.
 */

/** Read every frame, so the effects can be switched without a rebuild. */
export const effects = { bloom: true };

/**
 * Cap on shaded pixels. High enough that Retina hands stay sharp; the
 * adaptive loop still drops toward MIN if frames lag.
 */
const MAX_PIXELS = 3_600_000;
/** Floor for the adaptive cap — roughly 1080p, not soft 720p. */
const MIN_PIXELS = 1_100_000;
/** Start balanced, then earn more resolution only when the device is fast. */
const START_PIXELS = 2_200_000;
/** How much smaller the blur buffers are than the scene. */
const BLOOM_DIVISOR = 4;

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Keeps only what is bright enough to spill, with a soft knee. */
const BRIGHT_FRAGMENT = /* glsl */ `
  precision mediump float;
  uniform sampler2D uScene;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;

  void main() {
    vec3 colour = texture2D(uScene, vUv).rgb;
    float luma = dot(colour, vec3(0.2126, 0.7152, 0.0722));
    // Smoothstep rather than a hard cut: a hard threshold makes bloom pop on
    // and off as something drifts past it.
    float keep = smoothstep(uThreshold, uThreshold + uKnee, luma);
    gl_FragColor = vec4(colour * keep, 1.0);
  }
`;

/**
 * One half of a separable Gaussian. Running it twice along different axes
 * costs a fraction of what one square kernel of the same reach would.
 */
const BLUR_FRAGMENT = /* glsl */ `
  precision mediump float;
  uniform sampler2D uSource;
  uniform vec2 uStep;
  varying vec2 vUv;

  void main() {
    // Five taps either side, weighted the usual way.
    vec3 sum = texture2D(uSource, vUv).rgb * 0.2270270270;
    sum += texture2D(uSource, vUv + uStep * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(uSource, vUv - uStep * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(uSource, vUv + uStep * 3.2307692308).rgb * 0.0702702703;
    sum += texture2D(uSource, vUv - uStep * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
  precision mediump float;
  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform float uBloomStrength;
  uniform float uExposure;
  uniform float uVignette;
  varying vec2 vUv;

  /* Out of the renderer's working space and into the one a screen shows. */
  vec3 toScreen(vec3 c) {
    return mix(
      c * 12.92,
      1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
      step(vec3(0.0031308), c)
    );
  }

  /*
   * A filmic shoulder. Bright things ease toward white instead of slamming
   * into it, which is what stops the lamp filaments and the gold ring from
   * turning into flat white blobs once the bloom is added on top.
   */
  vec3 shoulder(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec3 colour = texture2D(uScene, vUv).rgb * uExposure;
    colour += texture2D(uBloom, vUv).rgb * uBloomStrength;

    colour = shoulder(colour * 1.05);
    // A little warmth in the low end, so the shadows are coffee rather than
    // slate. Costs nothing and does more for the mood than another light.
    colour *= vec3(1.03, 0.995, 0.955);

    vec2 fromCentre = vUv - 0.5;
    colour *= 1.0 - dot(fromCentre, fromCentre) * uVignette;

    gl_FragColor = vec4(toScreen(colour), 1.0);
  }
`;

type Rig = {
  scene: WebGLRenderTarget;
  bright: WebGLRenderTarget;
  blur: WebGLRenderTarget;
  brightMaterial: ShaderMaterial;
  blurMaterial: ShaderMaterial;
  compositeMaterial: ShaderMaterial;
  quad: Mesh;
  view: ThreeScene;
  camera: OrthographicCamera;
  width: number;
  height: number;
};

function target(width: number, height: number, depthBuffer: boolean) {
  const rt = new WebGLRenderTarget(width, height, {
    format: RGBAFormat,
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer,
  });
  // Linear, so values above one survive into the bright pass. An 8-bit
  // target clamped everything to 1, and the threshold of 1.02 — written
  // for an untonemapped scene — then kept nothing, so bloom never fired.
  rt.texture.colorSpace = LinearSRGBColorSpace;
  return rt;
}

function makeRig(width: number, height: number): Rig {
  const small = Math.max(1, Math.floor(width / BLOOM_DIVISOR));
  const shorter = Math.max(1, Math.floor(height / BLOOM_DIVISOR));

  const brightMaterial = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: BRIGHT_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uScene: { value: null },
      /*
       * Above one, because the scene arrives untone-mapped now. The renderer
       * used to apply its own curve first, which clamped everything to one
       * and left this threshold picking bloom out of mid-tones. With real
       * linear values a lit surface sits well under one and only genuine
       * highlights — filaments, the gold ring, the burst — pass.
       */
      /*
       * Well above one. A spotlight of 190 leaves the counter itself at
       * 1–3 in a half-float buffer, so a threshold of 1.02 bloomed the
       * whole bar and the room went peach. Lamps, the gold ring and the
       * burst still clear 1.6; the wood does not.
       */
      uThreshold: { value: 1.6 },
      uKnee: { value: 0.55 },
    },
  });
  const blurMaterial = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: BLUR_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uSource: { value: null },
      uStep: { value: new Vector2() },
    },
  });
  const compositeMaterial = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uScene: { value: null },
      uBloom: { value: null },
      uBloomStrength: { value: 0.55 },
      uExposure: { value: 0.5 },
      uVignette: { value: 0.22 },
    },
  });

  const quad = new Mesh(new PlaneGeometry(2, 2), compositeMaterial);
  quad.frustumCulled = false;
  const view = new ThreeScene();
  view.add(quad);

  return {
    scene: target(width, height, true),
    bright: target(small, shorter, false),
    blur: target(small, shorter, false),
    brightMaterial,
    blurMaterial,
    compositeMaterial,
    quad,
    view,
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    width,
    height,
  };
}

/** The scene's render size, capped so a retina display cannot run away with it. */
function shadingSize(width: number, height: number, cap: number) {
  const pixels = Math.max(1, width * height);
  const scale = Math.min(1, Math.sqrt(cap / pixels));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function disposeRig(rig: Rig | null) {
  if (!rig) return;
  rig.scene.dispose();
  rig.bright.dispose();
  rig.blur.dispose();
  rig.brightMaterial.dispose();
  rig.blurMaterial.dispose();
  rig.compositeMaterial.dispose();
  rig.quad.geometry.dispose();
  rig.view.clear();
}

export function GradePass() {
  const gl = useThree((state) => state.gl) as WebGLRenderer;
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const rigRef = useRef<Rig | null>(null);
  const adaptRef = useRef({ pixels: START_PIXELS, slow: 0, fast: 0 });

  // Built once on mount at a nominal size, then resized by the frame loop.
  // Creating it inside the loop instead would mean assigning a ref that the
  // cleanup below already closes over, which is exactly the tangle the React
  // compiler refuses to let through.
  //
  // Rebuilt on context restore as well: a lost context leaves every render
  // target invalid, and without a new rig the pass keeps drawing into
  // nothing — a blank canvas with no explanation, the same failure
  // GraphicsGuard is there to catch.
  useEffect(() => {
    const build = () => {
      disposeRig(rigRef.current);
      rigRef.current = makeRig(1280, 720);
    };
    build();
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextrestored", build);
    return () => {
      canvas.removeEventListener("webglcontextrestored", build);
      disposeRig(rigRef.current);
      rigRef.current = null;
    };
  }, [gl]);

  // Priority above zero means this owns the render loop.
  useFrame((_, delta) => {
    const adapt = adaptRef.current;
    if (delta > 0.022) {
      adapt.slow += 1;
      adapt.fast = 0;
      if (adapt.slow > 14 && adapt.pixels > MIN_PIXELS) {
        adapt.pixels = Math.max(MIN_PIXELS, Math.round(adapt.pixels * 0.84));
        adapt.slow = 0;
      }
    } else if (delta < 0.0165) {
      adapt.fast += 1;
      adapt.slow = 0;
      if (adapt.fast > 150 && adapt.pixels < MAX_PIXELS) {
        adapt.pixels = Math.min(MAX_PIXELS, Math.round(adapt.pixels / 0.92));
        adapt.fast = 0;
      }
    }

    const wanted = shadingSize(
      Math.max(1, Math.round(size.width * dpr)),
      Math.max(1, Math.round(size.height * dpr)),
      adapt.pixels,
    );

    const rig = rigRef.current;
    if (!rig) return;
    if (rig.width !== wanted.width || rig.height !== wanted.height) {
      rig.width = wanted.width;
      rig.height = wanted.height;
      rig.scene.setSize(wanted.width, wanted.height);
      const small = Math.max(1, Math.floor(wanted.width / BLOOM_DIVISOR));
      const shorter = Math.max(1, Math.floor(wanted.height / BLOOM_DIVISOR));
      rig.bright.setSize(small, shorter);
      rig.blur.setSize(small, shorter);
    }

    // 1. The scene itself, at the capped size.
    gl.setRenderTarget(rig.scene);
    gl.clear();
    gl.render(scene, camera);

    if (effects.bloom) {
      // 2. Keep only what is bright enough to spill.
      rig.quad.material = rig.brightMaterial;
      rig.brightMaterial.uniforms.uScene.value = rig.scene.texture;
      gl.setRenderTarget(rig.bright);
      gl.clear();
      gl.render(rig.view, rig.camera);

      // 3. Blur it, once across and once down.
      const blurWidth = rig.bright.width;
      const blurHeight = rig.bright.height;
      rig.quad.material = rig.blurMaterial;

      rig.blurMaterial.uniforms.uSource.value = rig.bright.texture;
      rig.blurMaterial.uniforms.uStep.value.set(1 / blurWidth, 0);
      gl.setRenderTarget(rig.blur);
      gl.clear();
      gl.render(rig.view, rig.camera);

      rig.blurMaterial.uniforms.uSource.value = rig.blur.texture;
      rig.blurMaterial.uniforms.uStep.value.set(0, 1 / blurHeight);
      gl.setRenderTarget(rig.bright);
      gl.clear();
      gl.render(rig.view, rig.camera);
    }

    // 4. Put it back together on the screen.
    rig.quad.material = rig.compositeMaterial;
    rig.compositeMaterial.uniforms.uScene.value = rig.scene.texture;
    rig.compositeMaterial.uniforms.uBloom.value = rig.bright.texture;
    rig.compositeMaterial.uniforms.uBloomStrength.value = effects.bloom ? 0.55 : 0;
    gl.setRenderTarget(null);
    gl.render(rig.view, rig.camera);
  }, 1);

  return null;
}
