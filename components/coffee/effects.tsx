"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { InstancedMesh, Mesh } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";

/**
 * The parts of the scene that are not objects.
 *
 * Steam, coffee grounds and a burst of praise all change shape every frame in
 * response to what the player is doing, so none of them can be a file on disk.
 * They are also what stops a tidy arrangement of models from looking like a
 * catalogue photograph.
 */

const UP = new Quaternion();
const PARKED = new Vector3(0, 0, -999);

/** Repeatable noise, so every run of the game arranges the beans identically. */
function scatter(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function scratch() {
  return {
    matrix: new Matrix4(),
    position: new Vector3(),
    scale: new Vector3(),
  };
}

/**
 * Steam off something hot. `amount` is read every frame rather than passed as a
 * prop so the game loop can turn it up as a cup fills without re-rendering the
 * scene around it.
 */
export function Steam({
  amount,
  position,
  spread = 0.32,
  height = 1.5,
  puffs = 14,
}: {
  amount: RefObject<number>;
  position: readonly [number, number, number];
  spread?: number;
  height?: number;
  puffs?: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const scratchRef = useRef<ReturnType<typeof scratch> | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const strength = Math.min(1, Math.max(0, amount.current ?? 0));
    mesh.visible = strength > 0.02;
    if (!mesh.visible) return;

    const s = (scratchRef.current ??= scratch());
    const time = state.clock.elapsedTime;

    for (let i = 0; i < puffs; i++) {
      // Each puff runs the same climb, offset in time, so the column never
      // stutters or restarts as a group.
      const offset = scatter(i + 1);
      const life = (time * (0.34 + offset * 0.16) + offset) % 1;
      const rise = life * height * (0.7 + strength * 0.5);
      // Drifting apart as it climbs is what reads as heat rather than smoke.
      const drift = spread * life * 1.6;
      const angle = offset * Math.PI * 2 + life * 1.3;

      s.position.set(
        position[0] + Math.cos(angle) * drift,
        position[1] + Math.sin(angle * 1.3) * drift * 0.6,
        position[2] + rise,
      );
      // Swells then vanishes: no fade needed, and no transparency sorting.
      const puff = Math.sin(life * Math.PI) * strength * (0.5 + offset * 0.6);
      s.scale.setScalar(Math.max(puff, 1e-4));
      s.matrix.compose(s.position, UP, s.scale);
      mesh.setMatrixAt(i, s.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, puffs]}
      visible={false}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.17, 10, 8]} />
      {/*
        Unlit on purpose. Steam is a translucent puff at seventeen percent —
        full PBR shading on it buys nothing anybody can see, and there are a
        lot of these on screen at once. The warmth the stage lamps used to put
        into it is baked into the colour instead.
      */}
      <meshBasicMaterial
        color="#ffeed6"
        transparent
        opacity={0.17}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/**
 * Roasted beans heaped in whatever is holding them. They jump while `shake` is
 * turned up, which is what makes grinding feel like it is doing something to
 * them rather than just spinning above them.
 */
export function Beans({
  position,
  radius = 0.42,
  count = 24,
  shake,
  colour = "#3b1f10",
}: {
  position: readonly [number, number, number];
  radius?: number;
  count?: number;
  shake?: RefObject<number>;
  colour?: string;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const scratchRef = useRef<ReturnType<typeof scratch> | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const s = (scratchRef.current ??= scratch());
    const time = state.clock.elapsedTime;
    const jump = Math.min(1, Math.max(0, shake?.current ?? 0));

    for (let i = 0; i < count; i++) {
      const a = scatter(i + 1);
      const b = scatter(i + 91);
      // Square-rooting the radius spreads them evenly over the disc instead of
      // crowding them into the middle.
      const r = Math.sqrt(a) * radius;
      const angle = b * Math.PI * 2;
      const hop = jump * Math.abs(Math.sin(time * 11 + i * 1.7)) * 0.14;

      s.position.set(
        position[0] + Math.cos(angle) * r,
        position[1] + Math.sin(angle) * r,
        position[2] + hop + (a + b) * 0.02,
      );
      s.scale.set(1, 1, 0.62);
      s.matrix.compose(s.position, UP, s.scale);
      mesh.setMatrixAt(i, s.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
      castShadow
    >
      <sphereGeometry args={[0.075, 8, 6]} />
      <meshStandardMaterial color={colour} roughness={0.45} metalness={0.05} />
    </instancedMesh>
  );
}

/**
 * A short spray of gold when a stage is cleared. `firedAt` holds the scene
 * clock reading of the moment it happened; setting it again replays the burst.
 */
export function Burst({
  firedAt,
  origin,
  count = 26,
  life = 0.9,
}: {
  firedAt: RefObject<number>;
  origin: RefObject<Vector3>;
  count?: number;
  life?: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const scratchRef = useRef<ReturnType<typeof scratch> | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const since = state.clock.elapsedTime - (firedAt.current ?? -99);
    const running = since >= 0 && since < life;
    mesh.visible = running;
    if (!running) return;

    const s = (scratchRef.current ??= scratch());
    const from = origin.current;
    const t = since / life;

    for (let i = 0; i < count; i++) {
      const a = scatter(i + 3);
      const b = scatter(i + 57);
      const angle = a * Math.PI * 2;
      const speed = 1.5 + b * 1.9;
      const reach = speed * t;
      // Thrown up and out, then pulled back down: an arc, not a starburst.
      const lift = (2.4 * t - 3.0 * t * t) * (0.7 + b * 0.9);

      s.position.set(
        from.x + Math.cos(angle) * reach,
        from.y + Math.sin(angle) * reach * 0.65,
        from.z + lift,
      );
      s.scale.setScalar(Math.max((1 - t) * (0.45 + a * 0.5), 1e-4));
      s.matrix.compose(s.position, UP, s.scale);
      mesh.setMatrixAt(i, s.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      visible={false}
      frustumCulled={false}
      renderOrder={3}
    >
      <sphereGeometry args={[0.12, 8, 6]} />
      <meshStandardMaterial
        color="#ffd88a"
        emissive="#ffae2b"
        emissiveIntensity={1.6}
        roughness={0.35}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

export { PARKED };

/**
 * The rope of liquid between a tipped vessel and whatever is underneath it.
 *
 * Drawn as a line of beads along the arc the liquid actually falls through, so
 * it leans the way the pour leans and stretches as the jug is lifted, rather
 * than being a straight line drawn between two points. `flow` is read every
 * frame: at zero the stream is gone, and the beads thicken as it opens up.
 */
export function PourStream({
  flow,
  from,
  to,
  colour,
  beads = 16,
}: {
  flow: RefObject<number>;
  from: RefObject<Vector3>;
  to: RefObject<Vector3>;
  colour: string;
  beads?: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const scratchRef = useRef<ReturnType<typeof scratch> | null>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const strength = Math.min(1, Math.max(0, flow.current ?? 0));
    mesh.visible = strength > 0.02;
    if (!mesh.visible) return;

    const s = (scratchRef.current ??= scratch());
    const spout = from.current;
    const target = to.current;
    const drop = Math.max(0.05, spout.z - target.z);

    for (let i = 0; i < beads; i++) {
      const t = i / (beads - 1);
      // Falling accelerates, so the beads bunch at the top and stretch out
      // toward the landing — which is what a real stream does.
      const fall = t * t;
      s.position.set(
        spout.x + (target.x - spout.x) * t,
        spout.y + (target.y - spout.y) * t,
        spout.z - drop * fall,
      );
      // Thins as it falls and as the flow closes — but never to nothing. A
      // trickle scaled straight off the flow came out microscopic, which read
      // as no pour at all rather than as a slow one.
      const width = (0.45 + strength * 0.55) * (1 - t * 0.4);
      s.scale.set(width, width, width);
      s.matrix.compose(s.position, UP, s.scale);
      mesh.setMatrixAt(i, s.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, beads]}
      visible={false}
      frustumCulled={false}
      renderOrder={4}
    >
      <sphereGeometry args={[0.095, 8, 6]} />
      {/* Drawn over whatever is in front of it. A stream that disappears behind
          the jug pouring it tells the player nothing, and the jug is exactly
          where the stream has to start. */}
      <meshStandardMaterial
        color={colour}
        roughness={0.12}
        metalness={0.05}
        emissive={colour}
        emissiveIntensity={0.45}
        depthTest={false}
      />
    </instancedMesh>
  );
}

/**
 * What ends up on the counter when the cup was already full. It creeps outward
 * as more is lost and stays there — a puddle that cleans itself up would be
 * telling the player their mistake did not matter.
 */
export function Spill({
  amount,
  position,
  colour,
  max = 1.15,
}: {
  amount: RefObject<number>;
  position: readonly [number, number, number];
  colour: string;
  max?: number;
}) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const spilled = Math.max(0, amount.current ?? 0);
    mesh.visible = spilled > 0.004;
    if (!mesh.visible) return;
    // Square root, because a puddle spreads over an area rather than a radius.
    mesh.scale.setScalar(Math.min(max, Math.sqrt(spilled) * 2.6));
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1], position[2]]}
      visible={false}
    >
      <circleGeometry args={[1, 32]} />
      <meshStandardMaterial
        color={colour}
        roughness={0.1}
        metalness={0.06}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}
