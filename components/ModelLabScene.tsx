"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, Lightformer } from "@react-three/drei";
import type { Group } from "three";
import { KitModel, PIECES } from "@/components/coffee/kit";
import type { Shape } from "@/components/coffee/solid";

/**
 * The turntable the models are inspected on.
 *
 * Neutral light, a floor to cast onto, and the collider drawn as a wireframe
 * over each piece so its shape can be checked against the model rather than
 * taken on trust.
 */

const SPACING = 3.4;
const PER_ROW = 5;

/** Draws the collider a piece declares, so it can be compared to the model. */
function Collider({ shape }: { shape: Shape }) {
  const colour = "#57e0b0";
  if (shape.kind === "slab") {
    return (
      <mesh position={[0, 0, shape.height / 2]}>
        <boxGeometry
          args={[shape.halfLong * 2, shape.halfShort * 2, shape.height]}
        />
        <meshBasicMaterial color={colour} wireframe />
      </mesh>
    );
  }
  if (shape.kind === "open") {
    return (
      <group>
        <mesh position={[0, 0, shape.height / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry
            args={[shape.radius, shape.radius, shape.height, 20, 1, true]}
          />
          <meshBasicMaterial color={colour} wireframe />
        </mesh>
        {/* The inner rim and the floor things land on. */}
        <mesh position={[0, 0, shape.floor]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[shape.rim, shape.rim, 0.02, 20]} />
          <meshBasicMaterial color="#ffb03a" wireframe />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[0, 0, shape.height / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry
        args={[shape.radius, shape.radius, shape.height, 20, 1, true]}
      />
      <meshBasicMaterial color={colour} wireframe />
    </mesh>
  );
}

function Turntable({
  spin,
  children,
}: {
  spin: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<Group>(null);
  useFrame((state, delta) => {
    if (ref.current && spin) ref.current.rotation.z += delta * 0.6;
  });
  return <group ref={ref}>{children}</group>;
}

export function ModelLabScene({
  showSolids,
  spin,
  picked,
}: {
  showSolids: boolean;
  spin: boolean;
  picked: string | null;
}) {
  const shown = picked
    ? PIECES.filter((piece) => piece.kind === picked)
    : PIECES;
  const rows = Math.ceil(shown.length / PER_ROW);

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{
        position: picked ? [0, -4.2, 2.6] : [0, -12, 11],
        fov: 40,
      }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ camera }) => camera.lookAt(0, 0, picked ? 0.6 : 0)}
    >
      <color attach="background" args={["#14161b"]} />
      <hemisphereLight args={["#ffffff", "#20242e", 0.8]} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[4, -6, 9]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <Environment resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={3}
          color="#ffffff"
          position={[0, 0, 8]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[12, 12, 1]}
        />
      </Environment>

      {/* Floor, so nothing floats without it being obvious. */}
      <mesh position={[0, 0, -0.01]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#20242c" roughness={0.95} />
      </mesh>

      {shown.map((piece, i) => {
        const column = i % PER_ROW;
        const row = Math.floor(i / PER_ROW);
        const x = picked ? 0 : (column - (PER_ROW - 1) / 2) * SPACING;
        const y = picked ? 0 : ((rows - 1) / 2 - row) * SPACING;
        return (
          <group key={piece.kind} position={[x, y, 0]}>
            <Turntable spin={spin}>
              <KitModel {...piece.entry} />
              {showSolids && <Collider shape={piece.entry.solid.shape} />}
            </Turntable>
            {/* Labelled in DOM rather than in 3D text, which would mean
                fetching a font before the lab could show anything. */}
            <Html
              position={[0, -SPACING * 0.42, 0.05]}
              center
              distanceFactor={14}
              style={{ pointerEvents: "none" }}
            >
              <span className="t-caption whitespace-nowrap text-label-2">
                {piece.kind}
              </span>
            </Html>
          </group>
        );
      })}
    </Canvas>
  );
}
