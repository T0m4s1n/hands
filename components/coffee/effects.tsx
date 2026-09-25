"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type {
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
} from "three";
import {
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { beanJump, beanLocalPose } from "@/components/coffee/beanPose";
import {
  spawnDumpBean,
  stepDumpBean,
  type FallingBean,
} from "@/components/coffee/beanDump";
import { particleCache } from "@/components/coffee/particleCache";

/**
 * The parts of the scene that are not objects.
 *
 * Steam, coffee grounds and a burst of praise all change shape every frame in
 * response to what the player is doing, so none of them can be a file on disk.
 * They are also what stops a tidy arrangement of models from looking like a
 * catalogue photograph.
 */

const UP = new Quaternion();
const SPIN_AXIS = new Vector3(0.6, 0.3, 0.75).normalize();
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
    rotation: new Quaternion(),
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
 *
 * With `heap`, height falls off toward the rim so the pile reads as sitting in
 * a bowl rather than a flat disc pasted on the handle.
 */
export function Beans({
  position,
  radius = 0.42,
  count = 24,
  shake,
  colour = "#3b1f10",
  heap = false,
  grain = 0.085,
}: {
  position: readonly [number, number, number];
  radius?: number;
  count?: number;
  shake?: RefObject<number>;
  colour?: string;
  /** Bowl-shaped pile (taller in the middle) instead of a flat scatter. */
  heap?: boolean;
  grain?: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const scratchRef = useRef<ReturnType<typeof scratch> | null>(null);
  const settledRef = useRef(false);
  const placedAt = useRef<string>("");

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const jump = beanJump(shake?.current ?? 0);
    const where = `${position[0]},${position[1]},${position[2]},${radius},${count},${grain}`;
    if (where !== placedAt.current) {
      placedAt.current = where;
      settledRef.current = false;
    }
    // At rest the heap never moves, so rewriting twenty-odd matrices every
    // frame is work nobody can see. The first still frame still has to land
    // them, which is what `settled` is for.
    if (jump === 0 && settledRef.current) return;
    settledRef.current = jump === 0;

    const s = (scratchRef.current ??= scratch());
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const local = beanLocalPose(i, radius, heap, jump, time);
      s.position.set(
        position[0] + local.x,
        position[1] + local.y,
        position[2] + local.z,
      );
      const squash = 0.55 + scatter(i + 44) * 0.2;
      s.scale.set(0.9 + scatter(i + 7) * 0.25, 0.85, squash);
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
      <sphereGeometry args={[grain, 10, 8]} />
      <meshStandardMaterial color={colour} roughness={0.5} metalness={0.04} />
    </instancedMesh>
  );
}

/** The classic barista heart, drawn on the foam as the jug zigzags. */
export function LatteArt({
  amount,
  position,
  radius = 0.2,
}: {
  amount: RefObject<number>;
  position: readonly [number, number, number];
  radius?: number;
}) {
  const rootRef = useRef<Group>(null);

  useFrame(() => {
    const root = rootRef.current;
    if (!root) return;
    const t = Math.min(1, Math.max(0, amount.current ?? 0));
    root.visible = t > 0.08;
    if (!root.visible) return;
    const size = radius * (0.55 + t * 1.35);
    root.scale.setScalar(size);
    root.position.set(position[0], position[1], position[2] + 0.012);
  });

  return (
    <group ref={rootRef} visible={false}>
      <mesh position={[-0.38, 0.22, 0]}>
        <sphereGeometry args={[0.42, 14, 10]} />
        <meshStandardMaterial color="#f7f1e6" roughness={0.62} metalness={0.02} />
      </mesh>
      <mesh position={[0.38, 0.22, 0]}>
        <sphereGeometry args={[0.42, 14, 10]} />
        <meshStandardMaterial color="#f7f1e6" roughness={0.62} metalness={0.02} />
      </mesh>
      <mesh position={[0, -0.42, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.62, 0.95, 3]} />
        <meshStandardMaterial color="#f7f1e6" roughness={0.62} metalness={0.02} />
      </mesh>
    </group>
  );
}

/** Fine coffee dust that rises only while the grinder is actively moving. */
export function GroundDust({
  amount,
  position,
  count = 12,
}: {
  amount: RefObject<number>;
  position: readonly [number, number, number];
  count?: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const scratchRef = useRef<ReturnType<typeof scratch> | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const strength = Math.min(1, Math.max(0, amount.current ?? 0));
    mesh.visible = strength > 0.035;
    if (!mesh.visible) return;
    const s = (scratchRef.current ??= scratch());
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const seed = scatter(i + 211);
      const life = (time * (0.42 + seed * 0.25) + seed) % 1;
      const angle = scatter(i + 267) * Math.PI * 2 + life * 1.5;
      const reach = (0.12 + life * 0.46) * strength;
      s.position.set(
        position[0] + Math.cos(angle) * reach,
        position[1] + Math.sin(angle) * reach,
        position[2] + life * (0.24 + strength * 0.32),
      );
      const size =
        Math.sin(life * Math.PI) * strength * (0.18 + seed * 0.2);
      s.scale.setScalar(Math.max(size, 1e-4));
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
    >
      <sphereGeometry args={[0.08, 7, 5]} />
      <meshBasicMaterial
        color="#c18a56"
        transparent
        opacity={0.28}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/**
 * Beans that leave a scoop and fall into a bowl — gravity, bounce, rim.
 * Fired by bumping `firedAt` to the scene clock; `from` / `to` are world points.
 */
export function BeanSpill({
  firedAt,
  from,
  to,
  count = 14,
  colour = "#3b1f10",
  life = 1.65,
}: {
  firedAt: RefObject<number>;
  from: RefObject<Vector3>;
  to: RefObject<Vector3>;
  count?: number;
  colour?: string;
  life?: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const scratchRef = useRef<ReturnType<typeof scratch> | null>(null);
  const beansRef = useRef<FallingBean[] | null>(null);
  const lastFireRef = useRef(-99);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const fired = firedAt.current ?? -99;
    const since = state.clock.elapsedTime - fired;
    const running = since >= 0 && since < life;
    mesh.visible = running;
    if (!running) return;

    const start = from.current;
    const end = to.current;
    if (fired !== lastFireRef.current) {
      lastFireRef.current = fired;
      beansRef.current = Array.from({ length: count }, (_, i) =>
        spawnDumpBean(i, start, end),
      );
    }
    const beans = beansRef.current;
    if (!beans) return;

    const bowl = {
      x: end.x,
      y: end.y,
      z: end.z,
      radius: 0.82,
    };
    const dt = Math.min(delta, 0.05);
    const s = (scratchRef.current ??= scratch());

    for (let i = 0; i < count; i++) {
      const bean = beans[i] ?? spawnDumpBean(i, start, end);
      if (since >= i * 0.03) stepDumpBean(bean, dt, bowl);
      s.position.set(bean.x, bean.y, bean.z);
      s.rotation.setFromAxisAngle(SPIN_AXIS, bean.spin);
      s.scale.set(1.15, 0.72, 0.88);
      s.matrix.compose(s.position, s.rotation, s.scale);
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
      visible={false}
    >
      <sphereGeometry args={[0.07, 10, 8]} />
      <meshStandardMaterial color={colour} roughness={0.5} metalness={0.04} />
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
 * This used to be a line of sixteen spheres strung along the arc. Beads are
 * easy and they are wrong: coffee does not fall as a row of marbles, and at
 * any real flow rate the gaps between them are the thing the eye catches. It
 * read as a necklace.
 *
 * It is one continuous tube now — a fixed grid of rings walked along the arc
 * every frame, never rebuilt. That matters: regenerating a TubeGeometry per
 * frame is the obvious way to do this and it allocates a new set of buffers
 * sixty times a second, which is how a pour turns into a stutter. Here the
 * buffers are made once and only their numbers change.
 *
 * Deliberately not a fluid simulation. Screen-space or FBO-based fluids look
 * superb and cost a frame budget this scene has already spent on the café; a
 * tapered tube with a little varicosity in it reads as a pour from a metre
 * away, which is where the player is sitting.
 */

/** Rings along the stream, and sides around it. 112 vertices in total. */
const STREAM_RINGS = 16;
const STREAM_SIDES = 8;

function streamGeometry() {
  const geometry = new BufferGeometry();
  const count = STREAM_RINGS * STREAM_SIDES;
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(count * 3), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(count * 3), 3),
  );

  // Two triangles per quad, written once. The topology never changes; only
  // where the vertices sit does.
  const index: number[] = [];
  for (let ring = 0; ring < STREAM_RINGS - 1; ring++) {
    for (let side = 0; side < STREAM_SIDES; side++) {
      const next = (side + 1) % STREAM_SIDES;
      const a = ring * STREAM_SIDES + side;
      const b = ring * STREAM_SIDES + next;
      const c = (ring + 1) * STREAM_SIDES + side;
      const d = (ring + 1) * STREAM_SIDES + next;
      index.push(a, c, b, b, c, d);
    }
  }
  geometry.setIndex(index);
  // Never culled: it is rebuilt around the jug every frame and its bounding
  // sphere would be a frame behind wherever it actually is.
  geometry.boundingSphere = null;
  return geometry;
}

function streamScratch() {
  return {
    point: new Vector3(),
    ahead: new Vector3(),
    behind: new Vector3(),
    tangent: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    radial: new Vector3(),
  };
}

export function PourStream({
  flow,
  from,
  to,
  colour,
  thickness = 1,
}: {
  flow: RefObject<number>;
  from: RefObject<Vector3>;
  to: RefObject<Vector3>;
  colour: string;
  thickness?: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const geometry = useMemo(() => streamGeometry(), []);
  const scratchRef = useRef<ReturnType<typeof streamScratch> | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const strength = Math.min(1, Math.max(0, flow.current ?? 0));
    mesh.visible = strength > 0.02;
    if (!mesh.visible) return;

    const s = (scratchRef.current ??= streamScratch());
    const spout = from.current;
    const target = to.current;
    const drop = Math.max(0.05, spout.z - target.z);
    const time = state.clock.elapsedTime;

    const position = geometry.getAttribute("position") as BufferAttribute;
    const normal = geometry.getAttribute("normal") as BufferAttribute;

    /** Where the stream is at `t` along its length, 0 at the spout. */
    const along = (t: number, out: Vector3) => {
      // Falling accelerates, so the stream stretches toward the landing.
      const fall = t * t;
      return out.set(
        spout.x + (target.x - spout.x) * t,
        spout.y + (target.y - spout.y) * t,
        spout.z - drop * fall,
      );
    };

    for (let ring = 0; ring < STREAM_RINGS; ring++) {
      const t = ring / (STREAM_RINGS - 1);
      along(t, s.point);

      // Central difference for the tangent, so every ring sits square to the
      // arc instead of to the straight line between its ends.
      along(Math.min(1, t + 0.02), s.ahead);
      along(Math.max(0, t - 0.02), s.behind);
      s.tangent.copy(s.ahead).sub(s.behind);
      if (s.tangent.lengthSq() < 1e-10) s.tangent.set(0, 0, -1);
      s.tangent.normalize();

      // A frame around the tangent. The reference axis is swapped when the
      // stream runs near it, or the cross product collapses and the tube
      // folds flat.
      s.right.set(0, 0, 1);
      if (Math.abs(s.tangent.z) > 0.92) s.right.set(1, 0, 0);
      s.up.crossVectors(s.tangent, s.right).normalize();
      s.right.crossVectors(s.up, s.tangent).normalize();

      // Thins as it falls and as the flow closes, but never to nothing: a
      // trickle scaled straight off the flow came out microscopic, which read
      // as no pour at all rather than as a slow one. The wobble is
      // varicosity — a falling stream necks in and out, and without it this
      // is a drinking straw.
      const wobble = 1 + Math.sin(t * 11 - time * 9) * 0.1 * strength;
      const width =
        (0.026 + strength * 0.042) *
        Math.max(0.55, thickness) *
        (1 - t * 0.38) *
        wobble;

      for (let side = 0; side < STREAM_SIDES; side++) {
        const angle = (side / STREAM_SIDES) * Math.PI * 2;
        s.radial
          .copy(s.right)
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(s.up, Math.sin(angle));
        const i = ring * STREAM_SIDES + side;
        position.setXYZ(
          i,
          s.point.x + s.radial.x * width,
          s.point.y + s.radial.y * width,
          s.point.z + s.radial.z * width,
        );
        // The radial direction is the surface normal of a tube, so there is
        // no reason to recompute them from the triangles.
        normal.setXYZ(i, s.radial.x, s.radial.y, s.radial.z);
      }
    }

    position.needsUpdate = true;
    normal.needsUpdate = true;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      visible={false}
      frustumCulled={false}
    >
      <meshStandardMaterial
        color={colour}
        roughness={0.22}
        metalness={0.04}
        emissive={colour}
        emissiveIntensity={0.24}
        transparent
        opacity={0.82}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Contact ring and droplets where the stream meets the receiving surface. */
export function PourImpact({
  flow,
  to,
  colour,
}: {
  flow: RefObject<number>;
  to: RefObject<Vector3>;
  colour: string;
}) {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const dropsRef = useRef<InstancedMesh>(null);
  const scratchRef = useRef<ReturnType<typeof scratch> | null>(null);

  useFrame((state) => {
    const group = groupRef.current;
    const ring = ringRef.current;
    const drops = dropsRef.current;
    if (!group || !ring || !drops) return;
    const strength = Math.min(1, Math.max(0, flow.current ?? 0));
    group.visible = strength > 0.03;
    if (!group.visible) return;

    group.position.copy(to.current);
    group.position.z += 0.018;
    const beat = (state.clock.elapsedTime * (2.8 + strength * 2.2)) % 1;
    ring.scale.setScalar(0.25 + beat * (0.25 + strength * 0.2));
    const material = ring.material as MeshStandardMaterial;
    material.opacity = (1 - beat) * (0.22 + strength * 0.36);

    const s = (scratchRef.current ??= scratch());
    for (let i = 0; i < 8; i++) {
      const phase = (beat + scatter(i + 22)) % 1;
      const angle = scatter(i + 77) * Math.PI * 2;
      const reach = phase * (0.16 + strength * 0.2);
      s.position.set(
        Math.cos(angle) * reach,
        Math.sin(angle) * reach,
        Math.sin(phase * Math.PI) * 0.1 * strength,
      );
      s.scale.setScalar(Math.max(0.15, 1 - phase) * (0.35 + strength * 0.35));
      s.matrix.compose(s.position, UP, s.scale);
      drops.setMatrixAt(i, s.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={ringRef}>
        <torusGeometry args={[1, 0.055, 8, 32]} />
        <meshStandardMaterial
          color={colour}
          emissive={colour}
          emissiveIntensity={0.18}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
      <instancedMesh ref={dropsRef} args={[undefined, undefined, 8]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshStandardMaterial
          color={colour}
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
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
    const spread = Math.min(max, Math.sqrt(spilled) * 2.6);
    // Flattened, not flat. A puddle has a meniscus: it beads up at the rim and
    // catches a highlight across the middle, and a disc does neither — lit
    // from above it is a painted circle. Height grows more slowly than width,
    // the way a spreading puddle actually thins.
    mesh.scale.set(spread, spread, 0.055 + spread * 0.045);
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1], position[2]]}
      visible={false}
    >
      {/* The top half of a sphere: a dome that sits on the counter rather
          than a disc printed on it. */}
      <sphereGeometry args={[1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
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
