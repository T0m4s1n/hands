"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { InstancedMesh } from "three";
import { Color } from "three";
import {
  CapsuleGeometry,
  Euler,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The audience: a hall full of silhouettes.
 *
 * These are not models, and that is the point. The first attempt used a kit of
 * blocky characters, and in a dark room at this distance a blocky character is
 * a box — square head, square shoulders, no taper — so ninety of them read as a
 * stack of crates rather than as people. What makes a silhouette read as human
 * is the outline: a round head, shoulders that slope, a body that narrows. Two
 * primitives get that right where a whole character kit got it wrong.
 *
 * Everyone shares one geometry and one material, so the entire crowd is a
 * single draw call, and each person differs by height, build and which way they
 * are facing.
 */

/** Set by the game when a stage is cleared, so the room can react to it. */
export const crowdMood = { cheerAt: -99 };

/** How tall an average person is, before their own variation. */
const HEIGHT = 2.05;
/** How long the cheer lasts after a stage is cleared. */
const CHEER = 2.2;

export type Seat = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Keeps every one of them out of step with its neighbours. */
  phase: number;
  /** Their own build, so a row is not a line of clones. */
  build: number;
  /** How light they are, which is what separates one from the next. */
  tone: number;
};

/** Repeatable noise, so the crowd is arranged the same way every time. */
function scatter(seed: number): number {
  const x = Math.sin(seed * 91.7 + 13.1) * 37219.37;
  return x - Math.floor(x);
}

/**
 * Where everyone sits. Rows step back and up, each one shifted half a place
 * along so nobody is directly behind anybody else — which is both what a raked
 * audience looks like and what stops the crowd reading as a grid.
 */
export function buildSeats({
  rows,
  perRow,
  spacing,
  front,
  depth,
  rise,
  floor,
}: {
  rows: number;
  perRow: number;
  spacing: number;
  front: number;
  depth: number;
  rise: number;
  floor: number;
}): Seat[] {
  const seats: Seat[] = [];
  for (let row = 0; row < rows; row++) {
    const stagger = (row % 2) * spacing * 0.5;
    for (let i = 0; i < perRow; i++) {
      const seed = row * 97 + i * 7 + 1;
      const across = (i - (perRow - 1) / 2) * spacing + stagger;
      seats.push({
        x: across + (scatter(seed) - 0.5) * spacing * 0.35,
        y: front + row * depth + (scatter(seed + 3) - 0.5) * depth * 0.3,
        z: floor + row * rise,
        // Everybody faces the counter, give or take a turned head.
        yaw: Math.PI + (scatter(seed + 11) - 0.5) * 0.6,
        phase: scatter(seed + 29) * Math.PI * 2,
        build: 0.86 + scatter(seed + 53) * 0.3,
        // Rows further back sit deeper in the haze, and no two neighbours are
        // quite the same shade. Against a single flat grey the crowd read as
        // one dark texture; a spread of values is what separates it into
        // people.
        tone: (1 - row / Math.max(rows, 1)) * 0.55 + scatter(seed + 71) * 0.45,
      });
    }
  }
  return seats;
}

/**
 * One person, as an outline.
 *
 * A capsule for the body, because its rounded top gives shoulders without
 * modelling any, and a sphere for the head sat just clear of them. Welded into
 * one geometry so the whole crowd can be instanced from it.
 */
function silhouette() {
  const shoulder = 0.4;
  const bodyLength = HEIGHT * 0.6;

  const body = new CapsuleGeometry(shoulder, bodyLength, 3, 10);
  // Capsules stand along Y; this room's up is Z.
  body.rotateX(Math.PI / 2);
  body.translate(0, 0, bodyLength / 2 + shoulder);

  const head = new SphereGeometry(shoulder * 0.56, 10, 7);
  head.translate(0, 0, bodyLength + shoulder * 1.95);

  const merged = mergeGeometries([body, head], false);
  merged?.computeVertexNormals();
  return merged;
}

export function Crowd({ seats }: { seats: Seat[] }) {
  const meshRef = useRef<InstancedMesh>(null);
  const painted = useRef(false);

  const built = useMemo(() => {
    const geometry = silhouette();
    return geometry
      ? {
          geometry,
          // Dark and lit only from behind and above, but not black: at
          // near-black the outline vanished and the crowd read as a row of
          // posts. The shape has to survive for the silhouette to work.
          material: new MeshLambertMaterial({ color: 0xffffff }),
        }
      : null;
  }, []);

  const scratch = useRef({
    matrix: new Matrix4(),
    position: new Vector3(),
    quaternion: new Quaternion(),
    euler: new Euler(),
    scale: new Vector3(),
  });

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Shade everybody once, the first frame there is a mesh to shade.
    if (!painted.current) {
      painted.current = true;
      const shade = new Color();
      const wardrobe: readonly [number, number, number][] = [
        [0.34, 0.1, 0.12],
        [0.22, 0.12, 0.08],
        [0.4, 0.28, 0.2],
        [0.16, 0.09, 0.08],
        [0.28, 0.16, 0.1],
      ];
      for (let i = 0; i < seats.length; i++) {
        const tone = seats[i].tone;
        const cloth = wardrobe[i % wardrobe.length];
        const lift = 0.45 + tone * 0.7;
        shade.setRGB(cloth[0] * lift, cloth[1] * lift, cloth[2] * lift);
        mesh.setColorAt(i, shade);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    const s = scratch.current;
    const time = state.clock.elapsedTime;
    const since = time - crowdMood.cheerAt;
    // A cheer that swells and dies away, rather than switching on and off.
    const cheer =
      since >= 0 && since < CHEER ? Math.sin((since / CHEER) * Math.PI) : 0;

    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      const sway = Math.sin(time * 1.4 + seat.phase);
      // Idling they shift their weight; cheering they come off the floor.
      const bob =
        sway * 0.04 + cheer * Math.abs(Math.sin(time * 6 + seat.phase)) * 0.45;

      s.position.set(seat.x, seat.y, seat.z + bob);
      s.euler.set(sway * 0.035 * (1 + cheer * 2), 0, seat.yaw);
      s.quaternion.setFromEuler(s.euler);
      // Build varies across and height with it, so nobody is a scaled copy of
      // the person beside them.
      s.scale.set(seat.build, seat.build, 2 - seat.build);
      s.matrix.compose(s.position, s.quaternion, s.scale);
      mesh.setMatrixAt(i, s.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!built) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[built.geometry, built.material, seats.length]}
      frustumCulled={false}
    />
  );
}
