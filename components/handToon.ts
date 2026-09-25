import {
  Color,
  DataTexture,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  ShaderMaterial,
  Vector3,
} from "three";

/**
 * Cel shading that does not take its light from the café's HDR rig.
 *
 * `MeshToonMaterial` samples its ramp from accumulated irradiance. The stage
 * spotlight is intensity 190 so the café metals bloom; that same number pins
 * every sample on the last texel of a four-step ramp, and the hand reads as
 * flat paint. Half-Lambert against a single direction stays in 0..1 whatever
 * the room is doing, so the steps stay steps.
 *
 * Output is linear. The grade pass converts for the game. The lab canvas
 * shows it a little dark, which is the cartoon's own shade rather than a
 * second sRGB conversion washing the steps out.
 *
 * The ramp is pitched bright on purpose: a Nintendo glove wants soft comic
 * bands, not ink-black shade. The darkest step still holds form; it just
 * does not swallow the cream.
 */

const STEPS = new Uint8Array([128, 178, 225, 255]);

function makeRamp() {
  const ramp = new DataTexture(STEPS, STEPS.length, 1, RedFormat);
  ramp.minFilter = NearestFilter;
  ramp.magFilter = NearestFilter;
  ramp.generateMipmaps = false;
  // Non-colour data. Treating it as sRGB gamma-corrects the steps and the
  // banding the ramp is there to make disappears.
  ramp.colorSpace = NoColorSpace;
  ramp.needsUpdate = true;
  return ramp;
}

const RAMP = makeRamp();

const VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    // Instanced meshes (bones, joints) carry their pose in instanceMatrix.
    // Without it every bone would draw in the same place.
#ifdef USE_INSTANCING
    mat4 worldMatrix = modelMatrix * instanceMatrix;
#else
    mat4 worldMatrix = modelMatrix;
#endif
    vec4 world = worldMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(worldMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uEmissiveIntensity;
  uniform sampler2D uRamp;
  uniform vec3 uLightDir;
  uniform float uRim;
  uniform float uOpacity;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 light = normalize(uLightDir);
    // Half-Lambert keeps the sample inside the ramp even on a back-facing
    // finger, so a knuckle never drops to a black hole.
    float wrapped = clamp(dot(normal, light) * 0.5 + 0.5, 0.0, 1.0);
    float shade = texture2D(uRamp, vec2(wrapped, 0.5)).r;

    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    // Soft comic rim — ink edge without a hard outline pass.
    float rim = uRim * pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.2);

    // Lifted ambient so shade bands stay readable as cartoon, not skeleton.
    vec3 colour = uColor * (0.28 + shade * 0.72);
    colour += uColor * rim;
    colour += uEmissive * uEmissiveIntensity;

    // Linear out. The grade pass converts when this is the game; the lab
    // canvas is already sRGB and a second conversion here would wash the
    // hand out. Both look right because the lab lights are dim enough that
    // linear-as-sRGB is only a little dark, which is the cartoon's shade.
    gl_FragColor = vec4(colour, uOpacity);
  }
`;

export type HandToonMaterial = ShaderMaterial & {
  uniforms: {
    uColor: { value: Color };
    uEmissive: { value: Color };
    uEmissiveIntensity: { value: number };
    uRamp: { value: DataTexture };
    uLightDir: { value: Vector3 };
    uRim: { value: number };
    uOpacity: { value: number };
  };
};

export function createHandToon(
  color: Color | string,
  rim = 0.38,
): HandToonMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uColor: { value: new Color(color) },
      uEmissive: { value: new Color(0x000000) },
      uEmissiveIntensity: { value: 0 },
      uRamp: { value: RAMP },
      uLightDir: { value: new Vector3(0.25, -0.35, 0.9) },
      uRim: { value: rim },
      uOpacity: { value: 1 },
    },
    transparent: true,
    depthWrite: true,
    toneMapped: false,
    fog: false,
  }) as HandToonMaterial;
}

export function paintHandToon(
  material: HandToonMaterial,
  color: Color,
  emissive: Color,
  intensity: number,
  lightDir: Vector3,
  opacity = 1,
) {
  material.uniforms.uColor.value.copy(color);
  material.uniforms.uEmissive.value.copy(emissive);
  material.uniforms.uEmissiveIntensity.value = intensity;
  material.uniforms.uLightDir.value.copy(lightDir);
  material.uniforms.uOpacity.value = opacity;
  material.transparent = opacity < 0.999;
  material.depthWrite = opacity > 0.85;
}
