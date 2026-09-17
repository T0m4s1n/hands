"use client";

import { Suspense, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { PCFSoftShadowMap } from "three";
import { HandGloves } from "@/components/GloveHand";
import { LandmarkDots } from "@/components/LandmarkDots";
import type { TrackedHand } from "@/hooks/useHandTracking";

/**
 * A plain studio for looking at the hands on their own: straight-on camera, a
 * neutral backdrop the silhouette reads against, and a floor far enough back to
 * catch a shadow without crowding anything.
 */
function Stage() {
  return (
    <>
      <color attach="background" args={["#141820"]} />
      <hemisphereLight args={["#ffffff", "#20242e", 0.75]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[3, 4, 6]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[-5, 1, 2]} intensity={0.4} color="#9fb4d8" />
      <mesh position={[0, 0, -1.6]} receiveShadow>
        <planeGeometry args={[24, 16]} />
        <meshStandardMaterial color="#1b2029" roughness={0.95} />
      </mesh>
    </>
  );
}

export function HandLabScene({
  handsRef,
  showLandmarks,
}: {
  handsRef: RefObject<TrackedHand[]>;
  showLandmarks: boolean;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 7.6], fov: 46 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = PCFSoftShadowMap;
      }}
    >
      <Stage />
      <Suspense fallback={null}>
        <HandGloves handsRef={handsRef} />
      </Suspense>
      <LandmarkDots handsRef={handsRef} visible={showLandmarks} />
    </Canvas>
  );
}
