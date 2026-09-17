"use client";

import { useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { Color, Vector3 } from "three";
import type { Handedness, TrackedHand } from "@/hooks/useHandTracking";

export type StageStatus = {
  index: number;
  total: number;
  title: string;
  instruction: string;
  progress: number;
  holding: boolean;
  near: boolean;
  done: boolean;
};

// "place" carries the item into a ring and lets go, "crank" turns a handle in
// circles, "hold" parks the item over a ring for a while.
type StageKind = "place" | "crank" | "hold";

type Stage = {
  id: string;
  title: string;
  instruction: string;
  kind: StageKind;
  item: [number, number];
  target: [number, number];
  radius: number;
  /** seconds for "hold", radians for "crank" */
  amount: number;
};

// Every stage gets the table to itself: two or three objects, nothing else to
// interpret. Positions are flat table coordinates — the camera looks straight
// down, so the player never has to judge depth.
const STAGES: readonly Stage[] = [
  {
    id: "dose",
    title: "Dosifica",
    instruction: "Toma la cuchara con granos y déjala sobre el molino.",
    kind: "place",
    item: [-2.25, -0.35],
    target: [1.85, 0.1],
    radius: 1.02,
    amount: 0,
  },
  {
    id: "grind",
    title: "Muele",
    instruction: "Toma la manivela y gírala siguiendo el círculo.",
    kind: "crank",
    item: [1.05, 0],
    target: [0, 0],
    // The ring doubles as the path the handle travels, so it shows the motion.
    radius: 1.05,
    amount: Math.PI * 3,
  },
  {
    id: "filter",
    title: "Filtro",
    instruction: "Lleva el filtro con el molido hasta la cafetera.",
    kind: "place",
    item: [-2.1, -0.15],
    target: [1.85, 0.1],
    radius: 1.02,
    amount: 0,
  },
  {
    id: "pour",
    title: "Vierte",
    instruction: "Sostén la tetera sobre el centro hasta llenar.",
    kind: "hold",
    item: [-2.3, -0.9],
    target: [0, 0.1],
    radius: 1.0,
    amount: 2.6,
  },
  {
    id: "serve",
    title: "Sirve",
    instruction: "Lleva la taza servida hasta el plato.",
    kind: "place",
    item: [-1.95, -0.1],
    target: [1.9, 0.1],
    radius: 1.05,
    amount: 0,
  },
];

const CRANK_ARM = 1.05;
const GRAB_RADIUS = 1.05;
const REST_Z = 0.12;
const LIFT_Z = 0.72;
// The destination ring lies on the tabletop like a circle of light; on the
// grinder stage it rises to the handle, where it doubles as the path to trace.
const RING_Z = 0.05;
const CRANK_Z = 1.46;
const PUBLISH_INTERVAL = 0.08;
const HINT_DOTS = 7;

// Coffee-bar palette: copper and brass for metal, porcelain for ceramic,
// roasted browns for everything the coffee itself touches.
const COPPER = "#b87333";
const BRASS = "#cd9a55";
const PORCELAIN = "#f2e7d5";
const WALNUT = "#5e4030";
const ESPRESSO = "#2a1a10";
const GROUNDS = "#5b3417";
const CREMA = "#c98f5a";

// The destination ring reads against the browns by being pale, then warms to
// gold as it fills. Copper would vanish against the copper props.
const IDLE = new Color("#efdcbd");
const READY = new Color("#ffb03a");

function createGameState() {
  return {
    stage: 0,
    progress: 0,
    turned: 0,
    angle: 0,
    intro: 0,
    holder: null as Handedness | null,
    near: false,
    wasGrabbing: { Left: false, Right: false } as Record<Handedness, boolean>,
    pos: new Vector3(STAGES[0].item[0], STAGES[0].item[1], REST_Z),
    done: false,
    round: 0,
    publishAt: -1,
    changed: true,
    v: new Vector3(),
    tint: new Color(),
  };
}

type GameState = ReturnType<typeof createGameState>;

/** Distance across the tabletop; height is irrelevant in a top-down game. */
function flatDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function CoffeeGame({
  handsRef,
  onStatus,
  round,
}: {
  handsRef: RefObject<TrackedHand[]>;
  onStatus: (status: StageStatus) => void;
  /** bump to start a fresh brew */
  round: number;
}) {
  const [view, setView] = useState(0);
  const stateRef = useRef<GameState | null>(null);
  const sceneRef = useRef<Group>(null);
  const itemRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const fillRef = useRef<Mesh>(null);
  const brewRef = useRef<Mesh>(null);
  const hintRefs = useRef<(Mesh | null)[]>([]);

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 0.05);
    const time = frame.clock.elapsedTime;
    const game = (stateRef.current ??= createGameState());
    const hands = handsRef.current ?? [];

    if (game.round !== round) {
      const fresh = createGameState();
      fresh.round = round;
      stateRef.current = fresh;
      setView(0);
      return;
    }

    if (game.done) {
      if (game.changed || time - game.publishAt > PUBLISH_INTERVAL) {
        game.publishAt = time;
        game.changed = false;
        onStatus({
          index: STAGES.length,
          total: STAGES.length,
          title: "Listo",
          instruction: "",
          progress: 1,
          holding: false,
          near: false,
          done: true,
        });
      }
      return;
    }

    const stage = STAGES[game.stage];
    game.intro = Math.min(1, game.intro + dt * 3.2);

    if (stage.kind === "crank") {
      game.pos.set(
        stage.target[0] + Math.cos(game.angle) * CRANK_ARM,
        stage.target[1] + Math.sin(game.angle) * CRANK_ARM,
        CRANK_Z,
      );
    }

    // Only the current stage's object can be picked up, so there is never a
    // question about what to reach for.
    let near = false;
    for (const handedness of ["Left", "Right"] as const) {
      const hand = hands.find((item) => item.handedness === handedness);
      if (!hand) {
        game.wasGrabbing[handedness] = false;
        continue;
      }
      const reach = flatDistance(
        hand.cursor.x,
        hand.cursor.y,
        game.pos.x,
        game.pos.y,
      );
      if (reach < GRAB_RADIUS) near = true;

      const grabbing = hand.isGrabbing;
      if (grabbing && !game.wasGrabbing[handedness] && !game.holder) {
        if (reach < GRAB_RADIUS) {
          game.holder = handedness;
          game.changed = true;
          if (stage.kind === "crank") {
            game.angle = Math.atan2(
              hand.cursor.y - stage.target[1],
              hand.cursor.x - stage.target[0],
            );
          }
        }
      }
      if (!grabbing && game.holder === handedness) {
        game.holder = null;
        game.changed = true;
      }
      game.wasGrabbing[handedness] = grabbing;
    }
    game.near = near;

    const holder = game.holder
      ? hands.find((item) => item.handedness === game.holder)
      : undefined;
    if (game.holder && !holder) {
      game.holder = null;
      game.changed = true;
    }

    let cleared = false;

    if (stage.kind === "crank") {
      if (holder) {
        const angle = Math.atan2(
          holder.cursor.y - stage.target[1],
          holder.cursor.x - stage.target[0],
        );
        let step = angle - game.angle;
        while (step > Math.PI) step -= Math.PI * 2;
        while (step < -Math.PI) step += Math.PI * 2;
        game.angle = angle;
        game.turned += Math.abs(step);
        game.progress = Math.min(1, game.turned / stage.amount);
        cleared = game.progress >= 1;
      }
    } else if (holder) {
      // Carried objects chase the hand instead of snapping to it, which hides
      // the jitter that is always present in tracking.
      game.v.set(holder.cursor.x, holder.cursor.y, LIFT_Z);
      game.pos.lerp(game.v, 1 - Math.pow(0.0009, dt));
      const reach = flatDistance(
        game.pos.x,
        game.pos.y,
        stage.target[0],
        stage.target[1],
      );
      const inside = reach < stage.radius;

      if (stage.kind === "hold") {
        game.progress = Math.min(
          1,
          Math.max(0, game.progress + (inside ? dt / stage.amount : -dt * 0.5)),
        );
        cleared = game.progress >= 1;
      } else {
        game.progress = inside ? 1 : Math.max(0, 1 - (reach - stage.radius) / 2);
      }
    } else {
      game.pos.z += (REST_Z - game.pos.z) * (1 - Math.pow(0.001, dt));
      if (stage.kind === "place") {
        const reach = flatDistance(
          game.pos.x,
          game.pos.y,
          stage.target[0],
          stage.target[1],
        );
        if (reach < stage.radius && game.progress >= 1) {
          game.pos.set(stage.target[0], stage.target[1], REST_Z);
          cleared = true;
        }
        game.progress = 0;
      }
    }

    if (cleared) {
      game.stage += 1;
      game.progress = 0;
      game.turned = 0;
      game.angle = 0;
      game.holder = null;
      game.intro = 0;
      game.changed = true;
      if (game.stage >= STAGES.length) {
        game.done = true;
      } else {
        const next = STAGES[game.stage];
        game.pos.set(next.item[0], next.item[1], REST_Z);
        setView(game.stage);
      }
      return;
    }

    // ---- draw ----
    const ease = game.intro * game.intro * (3 - 2 * game.intro);
    if (sceneRef.current) sceneRef.current.scale.setScalar(0.92 + ease * 0.08);

    const item = itemRef.current;
    if (item) {
      item.position.copy(game.pos);
      const pulse = game.holder ? 1.12 : game.near ? 1.06 : 1;
      item.scale.setScalar(pulse * (0.9 + ease * 0.1));
      if (stage.kind === "crank") item.rotation.z = game.angle;
    }

    const ring = ringRef.current;
    if (ring) {
      // Floats above the scenery: seen from straight above it reads as a halo
      // on the destination, and never hides inside a prop.
      ring.position.set(
        stage.target[0],
        stage.target[1],
        stage.kind === "crank" ? CRANK_Z + 0.08 : RING_Z,
      );
      ring.scale.setScalar(stage.radius * (1 + Math.sin(time * 2.4) * 0.02));
      const material = ring.material as MeshStandardMaterial;
      game.tint.copy(IDLE).lerp(READY, game.progress);
      material.color.copy(game.tint);
      material.emissive.copy(game.tint);
      material.emissiveIntensity = 0.55 + game.progress * 0.9;
    }

    // Halo under the one object that can be picked up, brighter once a hand is
    // close enough to actually grab it.
    const halo = haloRef.current;
    if (halo) {
      halo.visible = !game.holder;
      halo.position.set(game.pos.x, game.pos.y, game.pos.z - 0.1);
      const beat = game.near ? 1.12 : 1 + Math.sin(time * 3) * 0.05;
      halo.scale.setScalar(beat);
      const material = halo.material as MeshStandardMaterial;
      material.emissiveIntensity = game.near ? 1.5 : 0.6;
    }

    // Dots drifting from the object toward its destination: the whole
    // instruction, readable without words.
    const showHint = stage.kind === "place" && !game.holder;
    for (let i = 0; i < HINT_DOTS; i++) {
      const dot = hintRefs.current[i];
      if (!dot) continue;
      dot.visible = showHint;
      if (!showHint) continue;
      const t = ((i / HINT_DOTS + time * 0.35) % 1);
      dot.position.set(
        game.pos.x + (stage.target[0] - game.pos.x) * t,
        game.pos.y + (stage.target[1] - game.pos.y) * t,
        REST_Z + 0.02,
      );
      const fade = Math.sin(t * Math.PI);
      dot.scale.setScalar(0.06 + fade * 0.07);
    }

    if (fillRef.current) {
      const poured = stage.kind === "hold" ? game.progress : 0;
      fillRef.current.visible = poured > 0.02;
      fillRef.current.scale.set(poured, poured, 1);
    }
    if (brewRef.current) {
      const material = brewRef.current.material as MeshStandardMaterial;
      material.emissiveIntensity = game.near && !game.holder ? 0.35 : 0.12;
    }

    if (game.changed || time - game.publishAt > PUBLISH_INTERVAL) {
      game.publishAt = time;
      game.changed = false;
      onStatus({
        index: game.stage,
        total: STAGES.length,
        title: stage.title,
        instruction: stage.instruction,
        progress: game.progress,
        holding: game.holder !== null,
        near: game.near,
        done: false,
      });
    }
  });

  return (
    <group ref={sceneRef}>
      {/* Destination ring, unit sized and scaled per stage */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1, 0.055, 12, 48]} />
        <meshStandardMaterial roughness={0.35} metalness={0.1} />
      </mesh>

      {/* "Grab this" halo */}
      <mesh ref={haloRef}>
        <torusGeometry args={[0.72, 0.035, 10, 44]} />
        <meshStandardMaterial
          color="#ffdca8"
          emissive="#f0b429"
          emissiveIntensity={0.6}
          roughness={0.4}
        />
      </mesh>

      {[...Array(HINT_DOTS)].map((_, i) => (
        <mesh
          key={`hint-${i}`}
          ref={(mesh) => {
            hintRefs.current[i] = mesh;
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial
            color="#e8b87a"
            emissive={CREMA}
            emissiveIntensity={0.8}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* Stage scenery: destinations sit exactly where the stage data says. */}
      {view === 0 && (
        <>
          <Mat position={STAGES[0].item} />
          <Grinder position={STAGES[0].target} highlightRef={brewRef} />
        </>
      )}
      {view === 1 && <Grinder position={STAGES[1].target} big highlightRef={brewRef} />}
      {view === 2 && (
        <>
          <Brewer position={STAGES[2].target} highlightRef={brewRef} />
          <Mat position={STAGES[2].item} />
        </>
      )}
      {view === 3 && (
        <>
          <Brewer position={STAGES[3].target} filtered highlightRef={brewRef} />
          <mesh
            ref={fillRef}
            position={[STAGES[3].target[0], STAGES[3].target[1], REST_Z + 0.07]}
          >
            <circleGeometry args={[0.62, 36]} />
            <meshStandardMaterial color="#3d2113" roughness={0.25} />
          </mesh>
        </>
      )}
      {view === 4 && (
        <>
          <Saucer position={STAGES[4].target} highlightRef={brewRef} />
          <Mat position={STAGES[4].item} />
        </>
      )}

      {/* The one object the player can hold this stage */}
      <group ref={itemRef}>
        {view === 0 && <Scoop />}
        {view === 1 && <CrankArm />}
        {view === 2 && <Filter />}
        {view === 3 && <Kettle />}
        {view === 4 && <Cup />}
      </group>

    </group>
  );
}

/* ---------- props ---------- */

/**
 * A turned piece standing on the table: cylinders run along Z, which is up off
 * the tabletop, and `base` is where the piece rests rather than its centre, so
 * stacking real height onto something never buries it in the wood.
 */
function Turned({
  radius,
  top = radius,
  height,
  color,
  base = 0,
  roughness = 0.5,
  metalness = 0.1,
}: {
  radius: number;
  top?: number;
  height: number;
  color: string;
  base?: number;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh
      position={[0, 0, base + height / 2]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[top, radius, height, 44]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  );
}

function Grinder({
  position,
  big = false,
  highlightRef,
}: {
  position: [number, number];
  big?: boolean;
  highlightRef?: RefObject<Mesh | null>;
}) {
  const scale = big ? 1.22 : 1;
  return (
    <group position={[position[0], position[1], 0]} scale={scale}>
      {/* Walnut barrel, copper collar, brass burr, espresso in the hopper */}
      <Turned radius={0.8} height={0.16} color={ESPRESSO} roughness={0.85} metalness={0} />
      <Turned radius={0.9} top={0.82} height={0.58} color={WALNUT} base={0.14} roughness={0.68} metalness={0.05} />
      <mesh
        ref={highlightRef}
        position={[0, 0, 0.78]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.86, 0.8, 0.2, 44]} />
        <meshStandardMaterial
          color={COPPER}
          emissive={COPPER}
          emissiveIntensity={0.1}
          roughness={0.34}
          metalness={0.6}
        />
      </mesh>
      <Turned radius={0.8} top={0.6} height={0.26} color={WALNUT} base={0.88} roughness={0.68} metalness={0.05} />
      <Turned radius={0.55} height={0.06} color={ESPRESSO} base={1.1} roughness={0.95} metalness={0} />
      <mesh position={[0, 0, 1.14]}>
        <torusGeometry args={[0.3, 0.06, 12, 30]} />
        <meshStandardMaterial color={BRASS} roughness={0.28} metalness={0.75} />
      </mesh>
    </group>
  );
}

function Brewer({
  position,
  filtered = false,
  highlightRef,
}: {
  position: [number, number];
  filtered?: boolean;
  highlightRef?: RefObject<Mesh | null>;
}) {
  return (
    <group position={[position[0], position[1], 0]}>
      {/* Copper base ring carrying a porcelain cone */}
      <Turned radius={0.82} height={0.12} color={COPPER} roughness={0.34} metalness={0.7} />
      <mesh
        ref={highlightRef}
        position={[0, 0, 0.38]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.94, 0.58, 0.52, 44]} />
        <meshStandardMaterial
          color={PORCELAIN}
          emissive={PORCELAIN}
          emissiveIntensity={0.1}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0, 0, 0.64]}>
        <torusGeometry args={[0.92, 0.06, 12, 40]} />
        <meshStandardMaterial color={COPPER} roughness={0.34} metalness={0.7} />
      </mesh>
      {filtered && (
        <Turned radius={0.82} height={0.1} color={GROUNDS} base={0.56} roughness={0.95} metalness={0} />
      )}
    </group>
  );
}

function Saucer({
  position,
  highlightRef,
}: {
  position: [number, number];
  highlightRef?: RefObject<Mesh | null>;
}) {
  return (
    <group position={[position[0], position[1], 0]}>
      <mesh
        ref={highlightRef}
        position={[0, 0, 0.07]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.88, 0.76, 0.14, 44]} />
        <meshStandardMaterial
          color={PORCELAIN}
          emissive={PORCELAIN}
          emissiveIntensity={0.1}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0, 0.15]}>
        <torusGeometry args={[0.66, 0.05, 12, 40]} />
        <meshStandardMaterial color={COPPER} roughness={0.32} metalness={0.7} />
      </mesh>
    </group>
  );
}

function Mat({ position }: { position: [number, number] }) {
  return (
    <mesh position={[position[0], position[1], 0.015]} receiveShadow>
      <circleGeometry args={[0.95, 44]} />
      <meshStandardMaterial color="#241810" roughness={0.95} />
    </mesh>
  );
}

function Scoop() {
  return (
    <group>
      <Turned radius={0.46} top={0.5} height={0.3} color={BRASS} base={-0.06} roughness={0.3} metalness={0.75} />
      <Turned radius={0.42} height={0.08} color={GROUNDS} base={0.2} roughness={0.95} metalness={0} />
      <mesh position={[0.66, 0, 0.12]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.62, 16]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.75} />
      </mesh>
    </group>
  );
}

// Height comes from the item's own position (CRANK_Z), which keeps the handle
// and its halo at the same place; this group must not add any of its own.
function CrankArm() {
  return (
    <group>
      <mesh position={[-CRANK_ARM / 2, 0, 0]} castShadow>
        <boxGeometry args={[CRANK_ARM, 0.17, 0.15]} />
        <meshStandardMaterial color={BRASS} roughness={0.32} metalness={0.75} />
      </mesh>
      <mesh position={[0, 0, 0.12]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.34, 20]} />
        <meshStandardMaterial
          color="#ffdca8"
          emissive="#f0b429"
          emissiveIntensity={0.4}
          roughness={0.35}
          metalness={0.25}
        />
      </mesh>
    </group>
  );
}

function Filter() {
  return (
    <group>
      <Turned radius={0.5} top={0.78} height={0.34} color="#efe3cf" base={-0.08} roughness={0.85} metalness={0} />
      <Turned radius={0.7} height={0.08} color={GROUNDS} base={0.22} roughness={0.95} metalness={0} />
    </group>
  );
}

function Kettle() {
  return (
    <group>
      <Turned radius={0.56} top={0.44} height={0.62} color={COPPER} base={-0.1} roughness={0.26} metalness={0.82} />
      <Turned radius={0.24} height={0.08} color={BRASS} base={0.52} roughness={0.28} metalness={0.8} />
      {/* Gooseneck spout */}
      <mesh position={[0.62, 0, 0.26]} rotation={[0, Math.PI / 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.13, 0.66, 18]} />
        <meshStandardMaterial color={BRASS} roughness={0.28} metalness={0.8} />
      </mesh>
      <mesh position={[-0.6, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.07, 12, 26]} />
        <meshStandardMaterial color={WALNUT} roughness={0.6} metalness={0.05} />
      </mesh>
    </group>
  );
}

function Cup() {
  return (
    <group>
      <Turned radius={0.44} height={0.06} color={PORCELAIN} base={-0.1} roughness={0.32} metalness={0} />
      <Turned radius={0.46} top={0.58} height={0.5} color={PORCELAIN} base={-0.06} roughness={0.32} metalness={0} />
      <Turned radius={0.54} height={0.05} color="#3d2113" base={0.36} roughness={0.18} metalness={0} />
      <mesh position={[-0.66, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.055, 12, 26]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.32} />
      </mesh>
    </group>
  );
}
