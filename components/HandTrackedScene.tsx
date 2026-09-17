"use client";

import { Suspense, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { PCFSoftShadowMap } from "three";
import { HandGloves } from "@/components/GloveHand";
import { CoffeeGame, type StageStatus } from "@/components/CoffeeGame";
import type { TrackedHand } from "@/hooks/useHandTracking";

// The table is the XY plane and the camera looks straight down onto it, so
// tracked hands — which move in that same plane — read as hands hovering over
// the table, and depth never has to be judged by the player.
const TABLE_Z = -0.34;

function SceneContents({
  handsRef,
  onStatus,
  round,
}: {
  handsRef: RefObject<TrackedHand[]>;
  onStatus: (status: StageStatus) => void;
  round: number;
}) {
  return (
    <>
      <color attach="background" args={["#160e07"]} />
      <hemisphereLight args={["#ffe6bf", "#1a0f06", 0.7]} />
      <ambientLight intensity={0.46} color="#ffe8cc" />
      {/* Warm key light, like a lamp over a café counter */}
      <directionalLight
        position={[3.2, 2.6, 7.4]}
        intensity={1.8}
        color="#fff1dc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={0.5}
        shadow-camera-far={22}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[-5, -2, 3]} intensity={0.3} color="#c98f5a" />

      {/* Walnut table */}
      <RoundedBox
        args={[9.6, 6.4, 0.5]}
        radius={0.18}
        smoothness={5}
        position={[0, 0, TABLE_Z]}
        receiveShadow
      >
        <meshStandardMaterial color="#6b4831" roughness={0.85} metalness={0.02} />
      </RoundedBox>
      {/* Bar mat: keeps the play area readable against the wood */}
      <RoundedBox
        args={[7.6, 4.7, 0.06]}
        radius={0.12}
        smoothness={5}
        position={[0, 0, TABLE_Z + 0.27]}
        receiveShadow
      >
        <meshStandardMaterial color="#33231a" roughness={0.92} metalness={0.02} />
      </RoundedBox>

      <CoffeeGame handsRef={handsRef} onStatus={onStatus} round={round} />

      <Suspense fallback={null}>
        <HandGloves handsRef={handsRef} />
      </Suspense>
    </>
  );
}

export function HandTrackedScene({
  handsRef,
  onStatus,
  round,
}: {
  handsRef: RefObject<TrackedHand[]>;
  onStatus: (status: StageStatus) => void;
  round: number;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      // Tilted off straight-down into a three-quarter view: objects get their
      // volume back and the hands read as hovering over the table rather than
      // painted onto it, while the hand plane stays square enough to the camera
      // that reaching still maps one to one.
      camera={{ position: [0, -4.6, 7.1], fov: 44 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl, camera }) => {
        gl.shadowMap.type = PCFSoftShadowMap;
        camera.lookAt(0, 0.1, 0.2);
      }}
    >
      <SceneContents handsRef={handsRef} onStatus={onStatus} round={round} />
    </Canvas>
  );
}
