"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { PlaneGeometry } from "three";
import { KitPiece } from "./kit";
import type { LiquidLook } from "./liquid";
import type { PropKind } from "./recipes";
import { sampleSlosh, type Slosh } from "./slosh";

/**
 * Everything the player can pick up or aim at. The objects themselves come from
 * the CC0 kits — see `kit.tsx` — so what is left here is the handful of things
 * a model file cannot be: liquid that rises, the crema that forms on it, and
 * the worn ring on the tabletop that says where to reach.
 */

// Only the colours the game still mixes itself.
export const CREMA = "#c98f5a";
export const COFFEE = "#3a1d0e";
export const MILK = "#f6f1e8";
export const GROUNDS = "#4a2812";

/** How far the pestle swings from the middle of the mortar. */
export const CRANK_ARM = 1.05;

export function Prop({
  kind,
  position = [0, 0],
  lift = 0,
  scale = 1,
  showCargo = true,
  shake,
}: {
  kind: PropKind;
  position?: readonly [number, number];
  /** Seat a leftover on another piece instead of on the table. */
  lift?: number;
  scale?: number;
  /** Hide bowl contents after a dump / empty vessel. */
  showCargo?: boolean;
  shake?: RefObject<number>;
}) {
  return (
    <group position={[position[0], position[1], lift]} scale={scale}>
      {kind === "mat" ? (
        <Mat />
      ) : (
        <KitPiece kind={kind} showCargo={showCargo} shake={shake} />
      )}
    </group>
  );
}

/** The worn spot on the tabletop where a stage's object waits to be picked up. */
function Mat() {
  return (
    <>
      <mesh position={[0, 0, 0.012]} receiveShadow>
        <circleGeometry args={[0.95, 48]} />
        <meshStandardMaterial color="#3d2b1d" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <ringGeometry args={[0.9, 0.95, 48]} />
        <meshStandardMaterial color="#5a4230" roughness={0.88} />
      </mesh>
    </>
  );
}

/**
 * How full something is, shown as liquid standing in it with a skin of crema on
 * top, and the window that scores full marks drawn on the outside as two rings.
 * Liquid rising between two marks is a gauge anyone can read without being told.
 */
export function Level({
  fillRef,
  surfaceRef,
  bandRefs,
  slosh,
  radius,
  height,
  look,
}: {
  fillRef: RefObject<Mesh | null>;
  surfaceRef: RefObject<Mesh | null>;
  bandRefs: RefObject<(Mesh | null)[]>;
  slosh: RefObject<Slosh>;
  radius: number;
  height: number;
  /** Which liquid this is, which decides how it takes the light. */
  look: LiquidLook;
}) {
  return (
    <>
      {/* The body: a plain cylinder scaled along Z from the floor of the vessel
          as the level rises. Nobody can see into it, so nothing is spent on it. */}
      <mesh ref={fillRef} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius * 0.92, height, 40, 1, false]} />
        <meshStandardMaterial
          color={look.colour}
          roughness={look.roughness}
          metalness={look.metalness}
          transparent={look.opacity < 1}
          opacity={look.opacity}
        />
      </mesh>

      {/* The top, which is the part that moves. Coffee wears its crema here:
          what you actually see on an espresso is the skin, not the liquid. */}
      <LiquidSurface
        slosh={slosh}
        surfaceRef={surfaceRef}
        radius={radius * 0.97}
        look={look.skin ? { ...look, colour: look.skin, roughness: 0.7 } : look}
      />

      {[0, 1].map((i) => (
        <mesh
          key={`band-${i}`}
          ref={(mesh) => {
            if (bandRefs.current) bandRefs.current[i] = mesh;
          }}
        >
          <torusGeometry args={[radius + 0.2, 0.026, 8, 40]} />
          <meshStandardMaterial
            color="#ffd79a"
            emissive="#f0b429"
            emissiveIntensity={0.7}
            roughness={0.4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * A round patch of grid, built once, that the wave simulation is drawn on.
 *
 * A plane is square and a cup is not, so the square is pulled out into a disc —
 * every vertex keeps the square coordinates it started with, which are what
 * index the simulation, while sitting where a round surface needs it to sit.
 * That keeps the sim on a plain square grid, where the maths is simple, without
 * the liquid having visible corners.
 */
function discGrid(segments: number) {
  const geometry = new PlaneGeometry(2, 2, segments, segments);
  const position = geometry.attributes.position;
  const square = new Float32Array(position.count * 2);

  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i);
    const v = position.getY(i);
    square[i * 2] = u;
    square[i * 2 + 1] = v;
    position.setXY(
      i,
      u * Math.sqrt(Math.max(0, 1 - (v * v) / 2)),
      v * Math.sqrt(Math.max(0, 1 - (u * u) / 2)),
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return { geometry, square };
}

/**
 * The top of the liquid, moving. Everything below it is a plain cylinder — only
 * the surface has to be alive, and it is the only part anyone looks at.
 */
export function LiquidSurface({
  slosh,
  surfaceRef,
  radius,
  look,
  segments = 15,
  amplitude = 0.09,
}: {
  slosh: RefObject<Slosh>;
  /** Positioned by the game, which knows where the level currently is. */
  surfaceRef: RefObject<Mesh | null>;
  radius: number;
  look: LiquidLook;
  segments?: number;
  amplitude?: number;
}) {
  const { geometry, square } = useMemo(() => discGrid(segments), [segments]);
  const restRef = useRef(false);

  useFrame(() => {
    const mesh = surfaceRef.current;
    if (!mesh || !mesh.visible) return;
    const state = slosh.current;
    if (!state) return;

    const position = mesh.geometry.attributes.position;
    let moving = false;
    for (let i = 0; i < position.count; i++) {
      const height =
        sampleSlosh(state, square[i * 2], square[i * 2 + 1]) * amplitude;
      if (Math.abs(height) > 1e-4) moving = true;
      position.setZ(i, height);
    }
    position.needsUpdate = true;

    // Recomputing normals is the expensive part, so it is skipped entirely
    // once the surface has gone flat and stayed there.
    if (moving || !restRef.current) mesh.geometry.computeVertexNormals();
    restRef.current = !moving;
  });

  return (
    <mesh
      ref={surfaceRef}
      geometry={geometry}
      scale={[radius, radius, 1]}
      visible={false}
    >
      <meshStandardMaterial
        color={look.colour}
        roughness={look.roughness}
        metalness={look.metalness}
        transparent={look.opacity < 1}
        opacity={look.opacity}
        emissive={look.colour}
        emissiveIntensity={0.07}
      />
    </mesh>
  );
}
