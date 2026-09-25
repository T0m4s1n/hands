"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import {
  BackSide,
  NoToneMapping,
  ShaderMaterial,
  Vector3,
} from "three";
import { HandGloves } from "@/components/RobotHand";
import { CoffeeGame, type StageStatus } from "@/components/CoffeeGame";
import { emptyGloveHold } from "@/components/coffee/gloveGrip";
import { Cafe, FLOOR_Z } from "@/components/coffee/cafe";
import { GradePass } from "@/components/coffee/grade";
import type { Recipe } from "@/components/coffee/recipes";
import type { TrackedHand } from "@/hooks/useHandTracking";

// The table is the XY plane and the camera looks straight down onto it, so
// tracked hands — which move in that same plane — read as hands hovering over
// the table, and depth never has to be judged by the player.
const TABLE_Z = -0.34;

// Where the camera sits when the window is the shape the scene was framed for,
// and what it points at. A three-quarter view: objects keep their volume and
// the hands read as hovering over the table rather than painted onto it.
const CAMERA_HOME = new Vector3(0, -6.4, 6.0);
const CAMERA_TARGET = new Vector3(0, 0.95, 0.85);
const FRAMED_FOR = 16 / 10;

/**
 * A three.js camera's field of view is vertical, so a tall narrow window sees
 * less of the table across than a wide one — on a phone held upright, almost
 * none of it. Pulling the camera straight back along its own line of sight puts
 * that width back without the fisheye a wider lens would bring.
 */
function FitToWindow() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const pull = Math.min(2.1, Math.max(1, FRAMED_FOR / aspect));
    camera.position.copy(CAMERA_HOME).multiplyScalar(pull);
    camera.lookAt(CAMERA_TARGET);
    camera.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

/**
 * Watches for the graphics context going away.
 *
 * A browser can take the WebGL context back at any time — the machine sleeps,
 * the driver resets, another tab is greedy — and when it does, three stops
 * drawing and the canvas is left as a blank rectangle with no explanation. The
 * context usually comes back on its own; this asks for it and redraws when it
 * does, and says so out loud when it does not.
 */
function GraphicsGuard({ onLost }: { onLost: (lost: boolean) => void }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      // Without this the browser will not even try to give it back.
      event.preventDefault();
      onLost(true);
    };
    const restored = () => {
      onLost(false);
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, invalidate, onLost]);

  return null;
}

/**
 * Soft café sky — wine nadir, warm amber horizon, deep roast zenith.
 * Replaces the flat `#1c050a` void so the room has air behind the fog.
 */
function CafeAtmosphere() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vDir = normalize(world.xyz);
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            // Z is up in this scene.
            float h = clamp(vDir.z * 0.5 + 0.5, 0.0, 1.0);
            vec3 floorTone = vec3(0.07, 0.015, 0.03);
            vec3 horizon = vec3(0.42, 0.16, 0.08);
            vec3 ceiling = vec3(0.045, 0.012, 0.028);
            vec3 colour = mix(floorTone, horizon, smoothstep(0.28, 0.52, h));
            colour = mix(colour, ceiling, smoothstep(0.55, 0.92, h));
            // Warm bloom toward the stage front (+Y is behind the crowd).
            float stage = pow(clamp(-vDir.y * 0.5 + 0.5, 0.0, 1.0), 1.6);
            colour += vec3(0.12, 0.04, 0.015) * stage * 0.35;
            gl_FragColor = vec4(colour, 1.0);
          }
        `,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh scale={90} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[1, 48, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function SceneContents({
  recipe,
  handsRef,
  onStatus,
  round,
  running,
  showHands,
  showGuides,
}: {
  recipe: Recipe;
  handsRef: RefObject<TrackedHand[]>;
  onStatus: (status: StageStatus) => void;
  round: number;
  running: boolean;
  showHands: boolean;
  showGuides: boolean;
}) {
  const holdRef = useRef(emptyGloveHold());
  return (
    <>
      <FitToWindow />
      <CafeAtmosphere />
      {/* Fog matches the warm mid of the sky so the crowd dissolves into air,
          not into a hard black plate. */}
      <fog attach="fog" args={["#2a0c12", 12, 32]} />

      <hemisphereLight args={["#8a4a52", "#1a080c", 0.38]} />
      <ambientLight intensity={0.32} color="#e8cfc0" />

      <spotLight
        position={[0, 1.6, 7.2]}
        target-position={[0, 0.4, 0]}
        angle={0.72}
        penumbra={0.55}
        intensity={200}
        distance={26}
        decay={2}
        color="#ffd49a"
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-near={1}
        shadow-camera-far={26}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      />
      <pointLight
        position={[-5.4, -1.2, 3.4]}
        intensity={42}
        distance={14}
        decay={2}
        color="#f5990a"
      />
      <pointLight
        position={[5.4, -1.2, 3.4]}
        intensity={42}
        distance={14}
        decay={2}
        color="#f5990a"
      />
      {/* Soft fill from the player's side so gloves read sharp and round. */}
      <directionalLight
        position={[0, -8, 6]}
        intensity={0.85}
        color="#ffe2c4"
      />
      <directionalLight
        position={[0, 22, 12]}
        intensity={0.55}
        color="#a86a78"
      />
      <directionalLight
        position={[0, -6, 9]}
        intensity={0.35}
        color="#f5990a"
      />

      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={5}
          color="#ffdcae"
          position={[0, 2, 7]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[10, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3.4}
          color="#cfe2ff"
          position={[-7, 9, 6]}
          rotation={[0, Math.PI / 2.4, 0]}
          scale={[8, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          color="#ffb877"
          position={[6, -3, 3]}
          rotation={[0, -Math.PI / 3, 0]}
          scale={[6, 5, 1]}
        />
        <Lightformer
          form="ring"
          intensity={2.8}
          color="#fff2dd"
          position={[2, 3, 6]}
          scale={3}
        />
      </Environment>

      <Cafe />

      {/* The counter. A top the props sit on, a front panel that gives it
          thickness from the player's side, and a brass rail along the edge. */}
      <RoundedBox
        args={[13.4, 6.6, 0.44]}
        radius={0.16}
        smoothness={5}
        position={[0, 0, TABLE_Z]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#8a5538"
          roughness={0.55}
          metalness={0.05}
        />
      </RoundedBox>
      <mesh position={[0, -2.9, (TABLE_Z + FLOOR_Z) / 2]} receiveShadow>
        <boxGeometry args={[13.4, 0.5, TABLE_Z - FLOOR_Z]} />
        <meshStandardMaterial color="#5c3224" roughness={0.72} />
      </mesh>
      <mesh position={[0, -3.28, TABLE_Z + 0.12]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 13.4, 16]} />
        <meshStandardMaterial color="#f5990a" roughness={0.28} metalness={0.85} />
      </mesh>

      {/* Bar mat: keeps the play area readable against the wood */}
      <RoundedBox
        args={[7.6, 4.7, 0.06]}
        radius={0.12}
        smoothness={5}
        position={[0, 0, TABLE_Z + 0.24]}
        receiveShadow
      >
        <meshStandardMaterial color="#3a2218" roughness={0.88} metalness={0.02} />
      </RoundedBox>

      <CoffeeGame
        recipe={recipe}
        handsRef={handsRef}
        holdRef={holdRef}
        onStatus={onStatus}
        round={round}
        running={running}
        showGuides={showGuides}
      />

      <Suspense fallback={null}>
        <HandGloves handsRef={handsRef} holdRef={holdRef} active={showHands} />
      </Suspense>

      {/* Last, because it takes over the render loop. */}
      <GradePass />
    </>
  );
}

export function HandTrackedScene({
  recipe,
  handsRef,
  onStatus,
  round,
  running,
  showHands,
  showGuides = true,
}: {
  recipe: Recipe;
  handsRef: RefObject<TrackedHand[]>;
  onStatus: (status: StageStatus) => void;
  round: number;
  running: boolean;
  showHands: boolean;
  showGuides?: boolean;
}) {
  const [lost, setLost] = useState(false);

  return (
    <>
      <Canvas
        shadows="percentage"
        // Native resolution on 1× displays; Retina remains sharp, while the
        // post pass caps total shaded pixels. Forcing 1.5× on every monitor
        // spent 2.25× the fragments without adding visible detail.
        dpr={[1, 2]}
        // A three-quarter view, sat low enough to see the room behind the bar.
        // The angle is a compromise and worth naming: flatter shows more café
        // but squashes the axis the hands move along, so reaching stops mapping
        // one to one. Roughly forty degrees above the counter keeps both honest.
        camera={{ position: CAMERA_HOME.toArray(), fov: 46 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          /*
           * The grade pass owns tone mapping, so the renderer must not also
           * do it. R3F turns ACES on by default, which meant the picture was
           * rolled off twice: once on the way into the buffer and again in
           * the composite. Two shoulders stacked flatten the highlights, and
           * worse, they cost the bloom its whole job — the bright pass was
           * reading values three had already clamped to 1, so nothing in the
           * scene was ever bright enough to spill.
           */
          toneMapping: NoToneMapping,
        }}
      >
        <GraphicsGuard onLost={setLost} />
        <SceneContents
          recipe={recipe}
          handsRef={handsRef}
          onStatus={onStatus}
          round={round}
          running={running}
          showHands={showHands}
          showGuides={showGuides}
        />
      </Canvas>
      {lost && (
        <div className="scrim absolute inset-0 z-40 flex items-center justify-center p-6">
          <div className="material-thick squircle rounded-sheet max-w-sm p-6 text-center">
            <p className="t-headline">Se perdió el contexto gráfico</p>
            <p className="t-subhead mt-2 text-label-2">
              El navegador soltó la tarjeta gráfica. Suele volver solo; si no,
              recarga la página.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="squircle mt-5 min-h-[2.75rem] rounded-full bg-tint px-5 text-[0.9375rem] font-semibold text-tint-ink"
            >
              Recargar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
