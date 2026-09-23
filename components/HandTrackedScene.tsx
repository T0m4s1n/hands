"use client";

import { Suspense, useEffect, useState, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { NoToneMapping, Vector3 } from "three";
import { HandGloves } from "@/components/RobotHand";
import { CoffeeGame, type StageStatus } from "@/components/CoffeeGame";
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

function SceneContents({
  recipe,
  handsRef,
  onStatus,
  round,
  running,
}: {
  recipe: Recipe;
  handsRef: RefObject<TrackedHand[]>;
  onStatus: (status: StageStatus) => void;
  round: number;
  running: boolean;
}) {
  return (
    <>
      <FitToWindow />
      {/* Warm shadow rather than black: the room should look dim, not switched
          off, and a pure black background is what made it read as a void. */}
      <color attach="background" args={["#1c050a"]} />
      {/* Close and hard: the back of the hall should be a suggestion, not an
          inventory. Everything past the second row dissolves, which is both
          what a dark venue looks like and what stops the eye counting heads. */}
      <fog attach="fog" args={["#1c050a", 13, 27]} />

      {/*
        The light rig, in the order it matters.

        Daylight comes in cool through the windows behind the bar, the pendants
        over the counter are warm and close, and a low bounce stands in for
        light coming back off the floor. Two colour temperatures pulling against
        each other is most of why a room reads as a room: lit from one warm
        source only, everything turns the same shade of orange and goes flat.
      */}
      <hemisphereLight args={["#6b3a44", "#1a0509", 0.24]} />
      <ambientLight intensity={0.22} color="#d8b9a8" />

      {/*
        A hall with the lights down and one rig over the counter.

        Everything that used to light the room is gone: the daylight through
        the windows, the bounce off the floor, the fill from the player's side.
        What is left is the stage — which is the whole point of a stage — plus
        just enough cold spill at the back to keep the audience from being a
        black rectangle.
      */}
      <spotLight
        position={[0, 1.6, 7.2]}
        target-position={[0, 0.4, 0]}
        angle={0.72}
        penumbra={0.55}
        intensity={190}
        distance={26}
        decay={2}
        color="#ffcf8a"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={26}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      {/* Two lower washes across the counter, so the props are not lit from a
          single point and nothing on the bar falls into its own shadow. */}
      <pointLight
        position={[-5.4, -1.2, 3.4]}
        intensity={34}
        distance={14}
        decay={2}
        color="#f5990a"
      />
      <pointLight
        position={[5.4, -1.2, 3.4]}
        intensity={34}
        distance={14}
        decay={2}
        color="#f5990a"
      />

      {/* The audience, lit from behind and above by the hall's own dim glow.
          Cold, so the warm stage reads as the warm thing in the room. */}
      <directionalLight
        position={[0, 26, 16]}
        intensity={1.15}
        color="#a86a78"
      />
      {/* And a touch from the stage side, so the front rows catch its spill
          and the crowd has depth instead of being one flat cut-out. */}
      <directionalLight
        position={[0, -6, 9]}
        intensity={0.45}
        color="#f5990a"
      />

      {/*
        And an environment to reflect. Metal and glaze need something to mirror
        before they look like metal and glaze — with no environment at all the
        kit models read as painted plastic — and a handful of glowing rectangles
        gives them that for the cost of one small cube render.
      */}
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={4}
          color="#ffdcae"
          position={[0, 2, 7]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[10, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3}
          color="#cfe2ff"
          position={[-7, 9, 6]}
          rotation={[0, Math.PI / 2.4, 0]}
          scale={[8, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#ffb877"
          position={[6, -3, 3]}
          rotation={[0, -Math.PI / 3, 0]}
          scale={[6, 5, 1]}
        />
        <Lightformer
          form="ring"
          intensity={2.4}
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
          color="#7b4a33"
          roughness={0.6}
          metalness={0.04}
        />
      </RoundedBox>
      <mesh position={[0, -2.9, (TABLE_Z + FLOOR_Z) / 2]} receiveShadow>
        <boxGeometry args={[13.4, 0.5, TABLE_Z - FLOOR_Z]} />
        <meshStandardMaterial color="#522a1d" roughness={0.78} />
      </mesh>
      <mesh position={[0, -3.28, TABLE_Z + 0.12]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 13.4, 12]} />
        <meshStandardMaterial color="#f5990a" roughness={0.32} metalness={0.8} />
      </mesh>

      {/* Bar mat: keeps the play area readable against the wood */}
      <RoundedBox
        args={[7.6, 4.7, 0.06]}
        radius={0.12}
        smoothness={5}
        position={[0, 0, TABLE_Z + 0.24]}
        receiveShadow
      >
        <meshStandardMaterial color="#45291c" roughness={0.9} metalness={0.02} />
      </RoundedBox>

      <CoffeeGame
        recipe={recipe}
        handsRef={handsRef}
        onStatus={onStatus}
        round={round}
        running={running}
      />

      <Suspense fallback={null}>
        <HandGloves handsRef={handsRef} />
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
}: {
  recipe: Recipe;
  handsRef: RefObject<TrackedHand[]>;
  onStatus: (status: StageStatus) => void;
  round: number;
  running: boolean;
}) {
  const [lost, setLost] = useState(false);

  return (
    <>
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
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
