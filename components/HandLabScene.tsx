"use client";

import { Suspense, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { HandGloves } from "@/components/RobotHand";
import { LandmarkDots } from "@/components/LandmarkDots";
import type { TrackedHand } from "@/hooks/useHandTracking";

/**
 * A plain studio for looking at the hands on their own: straight-on camera, a
 * soft backdrop, and lighting that keeps sausages round instead of flat cards.
 */
function Stage() {
  return (
    <>
      <color attach="background" args={["#141820"]} />
      <hemisphereLight args={["#f5f0e8", "#1a1e28", 0.95]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[2.5, 3.5, 5]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[-4, 2, 3]} intensity={0.55} color="#c5d4e8" />
      <directionalLight position={[0, -2, 4]} intensity={0.35} color="#ffe8d0" />
      <mesh position={[0, 0, -1.6]} receiveShadow>
        <planeGeometry args={[24, 16]} />
        <meshStandardMaterial color="#1b2029" roughness={0.92} metalness={0} />
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
      shadows="percentage"
      dpr={[1.5, 2]}
      camera={{ position: [0, 0, 6.2], fov: 42 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
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
