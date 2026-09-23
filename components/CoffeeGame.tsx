"use client";

import { useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { Color, Vector3 } from "three";
import type { Handedness, TrackedHand } from "@/hooks/useHandTracking";
import { handGrabPoints } from "@/hooks/useHandTracking";
import {
  approach,
  ease,
  pulse,
  setSpring,
  spring,
  stepSpring,
  type Spring,
} from "@/components/coffee/anim";
import {
  Beans,
  Burst,
  PourStream,
  Spill,
  Steam,
} from "@/components/coffee/effects";
import { crowdMood } from "@/components/coffee/crowd";
import { KIT } from "@/components/coffee/kit";
import { LIQUIDS, type LiquidKind } from "@/components/coffee/liquid";
import {
  calmSlosh,
  createSlosh,
  splash,
  stepSlosh,
} from "@/components/coffee/slosh";
import {
  carryOver,
  carryRate,
  landingKick,
  overlap,
  settleHeight,
  type Placed,
} from "@/components/coffee/solid";
import {
  angleDelta,
  newStroke,
  newTurn,
  palmAngle,
  pourFlow,
  updateStroke,
  updateTurn,
  type StrokeState,
  type TurnState,
} from "@/components/coffee/gestures";
import {
  bandScore,
  placeScore,
  type PropKind,
  type Recipe,
  type Stage,
} from "@/components/coffee/recipes";
import { CRANK_ARM, CREMA, GROUNDS, Level, Prop } from "@/components/coffee/props";

export type StageStatus = {
  index: number;
  total: number;
  title: string;
  instruction: string;
  /** How far along this attempt is, for the bar. */
  progress: number;
  /** What the player has made so far, already in words. */
  detail: string;
  /** The mark this attempt would score if it ended now. */
  quality: number;
  holding: boolean;
  near: boolean;
  /** Marks for the stages already behind the player. */
  marks: readonly number[];
  /** The stage is about to be taken out of their hands. */
  hurry: boolean;
  done: boolean;
};

/** Reach matches the locked glove size — not the MediaPipe image span. */
const GRAB_RADIUS = 1.15;
const REST_Z = 0.12;
/**
 * The height a carried object rides at when it has nothing to clear.
 *
 * It used to ride wherever the hand was, read from how near the camera the
 * hand looked. That reading never had a trustworthy zero, so the height
 * shivered, and because two things only separate while they are at the same
 * height, a shivering height meant an object that was solid one frame and not
 * the next — which is how a spoon ends up inside a mortar. The game decides
 * the height now; see `carryOver`.
 */
const CARRY_LOW = 0.42;
/**
 * Pouring never drops below this, so what is being filled stays visible
 * underneath instead of being covered by the thing filling it.
 */
const POUR_LIFT_Z = 1.15;
const RING_Z = 0.05;
const CRANK_Z = 0.95;
const PUBLISH_INTERVAL = 0.08;
const HINT_DOTS = 7;

/**
 * How far the hand has to travel for a press or a shake to count as one. Small
 * enough to be comfortable, large enough that tracking jitter never reaches it.
 */
const PRESS_THROW = 0.38;
const SHAKE_THROW = 0.45;

/**
 * Nobody repeats a stage here, so nobody can be stuck in one either: after this
 * long the stage is taken and marked as it stands.
 *
 * Two clocks, because reading a new stage is not the same as fumbling one: the
 * long one runs until the object is first picked up, the short one from there.
 * Neither runs while no hand is tracked, so losing the camera never costs a
 * stage.
 */
const STAGE_LIMIT = 45;
const IDLE_LIMIT = 60;
const HURRY_AT = 8;

/** Below this, a release is the player putting it down, not an attempt. */
const MIN_EFFORT = 0.04;

/** How long a vessel is allowed to run over before the stage is taken away. */
const OVERFLOW_GRACE = 1.4;

// The destination ring reads against the browns by being pale, then warms to
// gold as the attempt gets closer to the mark.
const IDLE = new Color("#efdcbd");
const READY = new Color("#ffb03a");

/** Where liquid stands inside each vessel: how wide, how deep, how high up. */
const VESSELS: Partial<
  Record<PropKind, { radius: number; base: number; height: number }>
> = {
  mug: { radius: 0.34, base: 0.1, height: 0.42 },
  cup: { radius: 0.32, base: 0.12, height: 0.3 },
  brewer: { radius: 0.3, base: 0.1, height: 1.05 },
  machine: { radius: 0.34, base: 0.1, height: 0.42 },
  saucer: { radius: 0.4, base: 0.1, height: 0.3 },
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function createGameState(recipe: Recipe, round: number) {
  const first = recipe.stages[0];
  return {
    recipeId: recipe.id,
    round,
    stage: 0,
    marks: [] as number[],
    /** A fresh array per commit, so React sees the change. */
    published: [] as readonly number[],
    /** Seconds this stage has had a hand in front of it. */
    elapsed: 0,
    /** Whether its object has been picked up yet, which starts the short clock. */
    touched: false,
    /** The scored amount, in whatever this stage measures. */
    amount: 0,
    /** Pestle angle round the mortar, and how far it has been turned. */
    angle: 0,
    turn: null as TurnState | null,
    /** Back-and-forth counter, for shaking and pressing. */
    stroke: null as StrokeState | null,
    /** How the palm sat when the object was picked up, and the roll since. */
    grabAngle: 0,
    tilt: 0,
    intro: 0,
    holder: null as Handedness | null,
    near: false,
    wasGrabbing: { Left: false, Right: false } as Record<Handedness, boolean>,
    pos: new Vector3(first.item[0], first.item[1], REST_Z),
    done: false,
    publishAt: -1,
    changed: true,

    // ---- how it all moves ----
    /** Height off the table, sprung so picking up snaps and putting down lands. */
    lift: spring(REST_Z) as Spring,
    /** Scale, sprung with bounce so a grab pops. */
    grow: spring(1) as Spring,
    /** A whole-scene nod when something good happens. */
    swell: spring(1) as Spring,
    /** Scene-clock reading of the last commit, which drives the burst. */
    cheeredAt: -99,
    /** How hard the grounds are being worked. */
    churn: 0,
    /** Where the holding hand is riding, so the draw pass can follow it. */
    rideHeight: CARRY_LOW,
    /** Time since the last drip hit the surface. */
    dripAt: 0,
    /** How much has gone over the rim, and how long it has been going over. */
    spilled: 0,
    overflowing: 0,

    /** Reused when working out what the held object would be set down on. */
    supports: [
      { x: 0, y: 0, z: REST_Z, shape: { kind: "round", radius: 0, height: 0 } },
    ] as Placed[],
    /** The two bodies a carry is tested against, reused every frame. */
    carried: {
      x: 0,
      y: 0,
      z: REST_Z,
      shape: { kind: "round", radius: 0, height: 0 },
    } as Placed,
    obstacle: {
      x: 0,
      y: 0,
      z: REST_Z,
      shape: { kind: "round", radius: 0, height: 0 },
    } as Placed,
    /** Height it settled at last frame, to tell a landing from a carry. */
    wasResting: REST_Z,

    v: new Vector3(),
    tint: new Color(),
  };
}

type GameState = ReturnType<typeof createGameState>;

/** Distance across the tabletop; height is irrelevant in a top-down game. */
function flatDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Closest tabletop distance from the object to any grab probe on the hand. */
function handObjectDistance(hand: TrackedHand, x: number, y: number): number {
  let best = flatDistance(hand.cursor.x, hand.cursor.y, x, y);
  for (const point of handGrabPoints(hand.smoothedLandmarks)) {
    best = Math.min(best, flatDistance(point.x, point.y, x, y));
  }
  return best;
}

/** The mark this attempt stands at right now, which is also the ring's colour. */
function currentQuality(stage: Stage, game: GameState): number {
  if (stage.band) return bandScore(game.amount, stage.band);
  const reach = flatDistance(
    game.pos.x,
    game.pos.y,
    stage.target[0],
    stage.target[1],
  );
  return reach < stage.radius ? placeScore(reach, stage.radius) : 0;
}

/** The same number the ring is showing, said out loud for the HUD. */
function readout(stage: Stage, game: GameState): string {
  switch (stage.kind) {
    case "crank": {
      const turns = game.amount / (Math.PI * 2);
      return `${turns.toFixed(1)} de ${(stage.goal / (Math.PI * 2)).toFixed(1)} vueltas`;
    }
    case "hold":
    case "tilt":
      return `${Math.round(game.amount * 100)} % lleno`;
    case "tamp":
      return `${Math.round(game.amount)} de ${stage.goal} prensadas`;
    case "shake":
      return `${Math.round(game.amount)} de ${stage.goal} sacudidas`;
    case "place":
      // Only worth saying while it is actually in hand.
      return game.holder ? "suelta en el círculo" : "";
  }
}

export function CoffeeGame({
  recipe,
  handsRef,
  onStatus,
  round,
  running,
}: {
  recipe: Recipe;
  handsRef: RefObject<TrackedHand[]>;
  onStatus: (status: StageStatus) => void;
  /** bump to start a fresh brew */
  round: number;
  /**
   * False while a menu is up. The table stays on screen behind it, so without
   * this the stage clock would run against a player who is not even playing.
   */
  running: boolean;
}) {
  const [view, setView] = useState(0);
  const stateRef = useRef<GameState | null>(null);
  const sceneRef = useRef<Group>(null);
  const itemRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const fillRef = useRef<Mesh>(null);
  const surfaceRef = useRef<Mesh>(null);
  const bandRefs = useRef<(Mesh | null)[]>([]);
  const hintRefs = useRef<(Mesh | null)[]>([]);

  // Read by the effects every frame, written by the game loop, so neither one
  // has to re-render the other.
  const steamRef = useRef(0);
  const churnRef = useRef(0);
  const flowRef = useRef(0);
  const spoutRef = useRef(new Vector3());
  const basinRef = useRef(new Vector3());
  const spillRef = useRef(0);
  // The wave simulation for whatever is being filled. It lives here because
  // the game is what disturbs it; the surface only draws what it finds.
  const sloshRef = useRef(createSlosh(16));
  const cheeredAtRef = useRef(-99);
  const cheerOriginRef = useRef(new Vector3());

  const stages = recipe.stages;
  const shown = stages[Math.min(view, stages.length - 1)];
  const vesselKind = shown.vessel ?? shown.sits;
  const vessel = VESSELS[vesselKind] ?? VESSELS.mug!;
  const pours = shown.kind === "hold" || shown.kind === "tilt";
  const liquid = LIQUIDS[(shown.liquid ?? "coffee") as LiquidKind];

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 0.05);
    const time = frame.clock.elapsedTime;

    // Nobody is playing: the table stays on screen as scenery behind the menu,
    // but everything that only means something mid-stage goes away. A glowing
    // target ring behind a menu is noise pretending to be information.
    if (!running) {
      if (ringRef.current) ringRef.current.visible = false;
      if (haloRef.current) haloRef.current.visible = false;
      if (fillRef.current) fillRef.current.visible = false;
      if (surfaceRef.current) surfaceRef.current.visible = false;
      for (const band of bandRefs.current) if (band) band.visible = false;
      for (const dot of hintRefs.current) if (dot) dot.visible = false;
      steamRef.current = 0;
      churnRef.current = 0;
      flowRef.current = 0;
      spillRef.current = 0;
      return;
    }

    const game = (stateRef.current ??= createGameState(recipe, round));
    const hands = handsRef.current ?? [];

    if (game.round !== round || game.recipeId !== recipe.id) {
      stateRef.current = createGameState(recipe, round);
      setView(0);
      return;
    }

    if (game.done) {
      // The coffee is made: the markers have nothing left to point at, and the
      // only thing still moving is the steam off a finished cup.
      if (ringRef.current) ringRef.current.visible = false;
      if (haloRef.current) haloRef.current.visible = false;
      for (const dot of hintRefs.current) if (dot) dot.visible = false;
      steamRef.current = approach(steamRef.current, 0.85, 2, dt);
      if (game.changed || time - game.publishAt > PUBLISH_INTERVAL) {
        game.publishAt = time;
        game.changed = false;
        onStatus({
          index: stages.length,
          total: stages.length,
          title: "Listo",
          instruction: "",
          progress: 1,
          detail: "",
          quality: 0,
          holding: false,
          near: false,
          marks: game.published,
          hurry: false,
          done: true,
        });
      }
      return;
    }

    const stage = stages[game.stage];
    game.intro = Math.min(1, game.intro + dt * 3.2);
    if (hands.length > 0) game.elapsed += dt;

    // The pestle never travels with the hand: it swings round the mortar, and
    // the hand only decides how far round it has got.
    if (stage.kind === "crank") {
      game.pos.set(
        stage.target[0] + Math.cos(game.angle) * CRANK_ARM,
        stage.target[1] + Math.sin(game.angle) * CRANK_ARM,
        CRANK_Z,
      );
    }

    /** Take the stage as it stands, mark it, and move on. */
    const commit = (mark: number) => {
      game.marks.push(clamp01(mark));
      game.published = [...game.marks];
      // Praise lands where the work happened, not at some fixed spot.
      cheerOriginRef.current.set(stage.target[0], stage.target[1], REST_Z + 0.4);
      cheeredAtRef.current = time;
      game.cheeredAt = time;
      // And the room joins in.
      crowdMood.cheerAt = time;
      game.swell.velocity += 2.2;
      game.stage += 1;
      game.amount = 0;
      game.angle = 0;
      game.turn = null;
      game.stroke = null;
      game.tilt = 0;
      game.elapsed = 0;
      game.touched = false;
      game.intro = 0;
      game.holder = null;
      game.changed = true;
      calmSlosh(sloshRef.current);
      game.spilled = 0;
      game.overflowing = 0;
      if (game.stage >= stages.length) {
        game.done = true;
      } else {
        const next = stages[game.stage];
        game.pos.set(next.item[0], next.item[1], REST_Z);
        setSpring(game.lift, REST_Z);
        // The next stage's object drops in rather than appearing.
        setSpring(game.grow, 0.55);
        setView(game.stage);
      }
    };

    // Only the current stage's object can be picked up, so there is never a
    // question about what to reach for.
    let near = false;
    for (const handedness of ["Left", "Right"] as const) {
      const hand = hands.find((item) => item.handedness === handedness);
      if (!hand) {
        game.wasGrabbing[handedness] = false;
        continue;
      }
      const reach = handObjectDistance(hand, game.pos.x, game.pos.y);
      if (reach < GRAB_RADIUS) near = true;

      const grabbing = hand.isGrabbing;
      if (grabbing && !game.wasGrabbing[handedness] && !game.holder) {
        if (reach < GRAB_RADIUS) {
          game.holder = handedness;
          game.changed = true;
          // A grab should feel like a catch: throw the scale past its target
          // and let the spring pull it back.
          game.grow.velocity += 6;
          if (!game.touched) {
            game.touched = true;
            game.elapsed = 0;
          }
          // Every measurement starts from where the hand was at the pinch, so
          // the player never has to hold it at some particular angle first.
          game.grabAngle = hand.roll ?? palmAngle(hand.smoothedLandmarks);
          game.tilt = 0;
          if (stage.kind === "crank") {
            game.angle = Math.atan2(
              hand.cursor.y - stage.target[1],
              hand.cursor.x - stage.target[0],
            );
            game.turn = newTurn(game.angle);
            game.turn.turned = game.amount;
          }
          if (stage.kind === "shake") game.stroke = newStroke(hand.cursor.x);
          if (stage.kind === "tamp") game.stroke = newStroke(hand.cursor.y);
        }
      }
      game.wasGrabbing[handedness] = grabbing;
    }
    game.near = near;

    const holder = game.holder
      ? hands.find((item) => item.handedness === game.holder)
      : undefined;
    // Letting go, or losing the hand entirely, both end the attempt the same way.
    const released = game.holder !== null && (!holder || !holder.isGrabbing);
    /** How hard the player is working this instant, 0..1, for the effects. */
    let working = 0;

    if (holder && !released) {
      if (stage.kind === "crank") {
        const angle = Math.atan2(
          holder.cursor.y - stage.target[1],
          holder.cursor.x - stage.target[0],
        );
        const turn = (game.turn ??= newTurn(angle));
        const moved = updateTurn(turn, angle);
        working = clamp01(moved / Math.max(dt, 1e-3) / 6);
        game.angle = angle;
        game.amount = turn.turned;
      } else {
        // Carried objects chase the hand instead of snapping to it, which hides
        // the jitter that is always present in tracking — and heavy ones chase
        // it more slowly, which is most of what makes them feel heavy.
        const follow = carryRate(KIT[stage.holds]?.solid.mass ?? 1);
        game.pos.x = approach(game.pos.x, holder.cursor.x, follow, dt);
        game.pos.y = approach(game.pos.y, holder.cursor.y, follow, dt);

        // Keep what is being carried out of what it is being carried toward.
        //
        // Without this the object simply drove through whatever was in the
        // way — a spoon handle straight through the wall of the mortar — which
        // is the single most obvious way a scene stops being believable. It
        // only pushes sideways, and only while the two are at the same height:
        // lift the spoon over the rim and it drops in, exactly as it should.
        const mine = KIT[stage.holds]?.solid;
        const theirs = KIT[stage.sits]?.solid;
        if (mine && theirs) {
          const carried = game.carried;
          carried.x = game.pos.x;
          carried.y = game.pos.y;
          carried.z = game.lift.value;
          carried.shape = mine.shape;

          const obstacle = game.obstacle;
          obstacle.x = stage.target[0];
          obstacle.y = stage.target[1];
          obstacle.z = REST_Z;
          obstacle.shape = theirs.shape;

          // How high to ride so it passes over rather than through. This is
          // the fix for the interpenetration: the height is decided from the
          // geometry instead of read off the hand, so it is the same every
          // time you make the same approach.
          game.rideHeight = carryOver(
            mine.shape,
            obstacle,
            game.pos.x,
            game.pos.y,
            CARRY_LOW,
          );

          // Still separated sideways, for the moment on the way up when the
          // object has not finished rising. Eased rather than snapped, so it
          // reads as sliding along the rim, not as an invisible wall.
          const hit = overlap(carried, obstacle);
          if (hit) {
            const push = Math.min(hit.by, hit.by * 12 * dt + 0.004);
            game.pos.x += hit.dx * push;
            game.pos.y += hit.dy * push;
          }
        } else {
          game.rideHeight = CARRY_LOW;
        }
        const reach = flatDistance(
          game.pos.x,
          game.pos.y,
          stage.target[0],
          stage.target[1],
        );
        const inside = reach < stage.radius;

        if (stage.kind === "hold") {
          if (inside) {
            game.amount += (stage.rate ?? 0.4) * dt;
            working = 1;
          }
        } else if (stage.kind === "tilt") {
          game.tilt = angleDelta(
            game.grabAngle,
            holder.roll ?? palmAngle(holder.smoothedLandmarks),
          );
          const flow = pourFlow(game.tilt);
          if (inside) {
            game.amount += flow * (stage.rate ?? 0.4) * dt;
            working = flow;
          }
        } else if (stage.kind === "shake") {
          const stroke = (game.stroke ??= newStroke(holder.cursor.x));
          updateStroke(stroke, holder.cursor.x, SHAKE_THROW);
          game.amount = stroke.count;
          working = 1;
        } else if (stage.kind === "tamp") {
          const stroke = (game.stroke ??= newStroke(holder.cursor.y));
          const began = updateStroke(stroke, holder.cursor.y, PRESS_THROW);
          // Only the downward half of a press counts, so lifting the tamper
          // back up between presses never scores twice.
          if (began < 0 && inside) {
            game.amount += 1;
            // The press lands with a thump.
            game.grow.velocity -= 5;
            game.swell.velocity += 0.8;
            working = 1;
          }
        }
      }

      // Past the brim it goes on the counter. Cutting the stage off the instant
      // it filled hid the mistake; letting it run over shows the player what
      // they did, and the puddle stays there afterwards.
      if (pours && game.amount >= 1) {
        const over = game.amount - 1;
        game.amount = 1;
        game.spilled += over;
        game.overflowing += dt;
        if (game.overflowing > OVERFLOW_GRACE) {
          commit(bandScore(1, stage.band ?? [1, 1]));
          return;
        }
      }
    }

    if (released) {
      game.holder = null;
      game.changed = true;
      const reach = flatDistance(
        game.pos.x,
        game.pos.y,
        stage.target[0],
        stage.target[1],
      );
      if (stage.kind === "place") {
        if (reach < stage.radius) {
          game.pos.x = stage.target[0];
          game.pos.y = stage.target[1];
          commit(placeScore(reach, stage.radius));
          return;
        }
        // Dropped short: it stays where it fell, set down on whatever is under
        // it, and can be picked up again. It is never left in mid-air.
        game.lift.velocity = -Math.abs(game.lift.velocity) - 1.2;
      } else if (game.amount > MIN_EFFORT) {
        commit(currentQuality(stage, game));
        return;
      }
    }

    // Out of time: the stage is marked as it stands and the brew carries on.
    const limit = game.touched ? STAGE_LIMIT : IDLE_LIMIT;
    if (game.elapsed > limit) {
      commit(currentQuality(stage, game));
      return;
    }

    // ---- draw ----
    const quality = currentQuality(stage, game);
    const progress =
      stage.kind === "place"
        ? quality
        : clamp01(game.amount / Math.max(stage.goal, 1e-4));
    const held = game.holder !== null;

    const intro = ease(game.intro);
    const cheer = pulse(time - game.cheeredAt, 0.5);
    if (sceneRef.current) {
      const swell = stepSpring(game.swell, 1, 90, dt, 0.55);
      sceneRef.current.scale.setScalar((0.93 + intro * 0.07) * swell);
    }

    // Height is a spring, so picking something up snaps it off the table and
    // putting it down lets it drop and settle — onto whatever is under it. An
    // object is never left hanging at the height the hand let go of it, and
    // never sunk into the thing it was set on.
    const under = KIT[stage.sits];
    let restingHeight = REST_Z;
    if (stage.kind === "crank") {
      restingHeight = CRANK_Z;
    } else if (under) {
      const support = game.supports[0];
      support.x = stage.target[0];
      support.y = stage.target[1];
      support.z = REST_Z;
      support.shape = under.solid.shape;
      restingHeight = settleHeight(game.pos.x, game.pos.y, REST_Z, game.supports);
    }
    const carryHeight =
      stage.kind === "crank"
        ? // Cranking swings the pestle inside the mortar, so it holds the one
          // height the whole stage rather than taking a ride height it never
          // set. Left as it was, this read a stale carry height from the last
          // stage and started the grind at the wrong depth.
          CRANK_Z
        : stage.kind === "tilt"
          ? Math.max(POUR_LIFT_Z, game.rideHeight)
          : game.rideHeight;
    stepSpring(
      game.lift,
      held ? carryHeight : restingHeight,
      held ? 150 : 90,
      dt,
      held ? 0.45 : 0.15,
    );
    // The moment it touches down, its own weight shows up as a thump.
    const falling = game.lift.velocity;
    if (!held && game.lift.value <= restingHeight + 0.02 && falling < -0.4) {
      const mass = KIT[stage.holds]?.solid.mass ?? 1;
      const kick = landingKick(mass, -falling);
      game.grow.velocity -= kick * 4;
      game.swell.velocity += kick * 0.5;
      // A cup put down hard rocks whatever is in it.
      if (pours && game.amount > 0.02) {
        splash(sloshRef.current, 0, 0, kick * 0.9, 4);
      }
    }
    game.wasResting = restingHeight;

    const wanted = held ? 1.1 : game.near ? 1.05 : 1;
    stepSpring(game.grow, wanted * (0.92 + intro * 0.08), 170, dt, 0.4);

    const item = itemRef.current;
    if (item) {
      // A waiting object bobs, so the eye finds it without a label pointing at
      // it; a held one holds still, because the hand is already doing that job.
      const idle = held ? 0 : Math.sin(time * 2.2) * 0.045;
      item.position.set(game.pos.x, game.pos.y, game.lift.value + idle);
      item.scale.setScalar(Math.max(game.grow.value, 0.05));
      item.rotation.set(0, 0, 0);
      if (stage.kind === "crank") {
        // The pestle leans into the circle it is being swung round.
        item.rotation.z = game.angle + Math.PI / 2;
        item.rotation.x = 0.3 + working * 0.14;
      } else {
        // Rolling the wrist either way tips the spout down, so the object
        // always agrees with what the hand is doing.
        if (stage.kind === "tilt") {
          item.rotation.y = Math.min(Math.abs(game.tilt), 1.25);
        }
        if (!held) item.rotation.z = Math.sin(time * 1.1) * 0.06;
      }
    }

    const ring = ringRef.current;
    if (ring) {
      ring.visible = true;
      // Floats above the scenery: seen from above it reads as a halo on the
      // destination, and never hides inside a prop.
      ring.position.set(
        stage.target[0],
        stage.target[1],
        stage.kind === "crank" ? CRANK_Z + 0.55 : RING_Z,
      );
      // Beats faster the closer the attempt is to its mark, and jumps once as
      // the stage is cleared.
      const beat = Math.sin(time * (2.2 + quality * 3.4)) * 0.022;
      ring.scale.setScalar(stage.radius * (1 + beat + cheer * 0.22));
      const material = ring.material as MeshStandardMaterial;
      // Gold means "this is the mark you are scoring", not "you are finished":
      // overshooting cools it again, which is the whole warning.
      game.tint.copy(IDLE).lerp(READY, quality);
      material.color.copy(game.tint);
      material.emissive.copy(game.tint);
      material.emissiveIntensity = 0.55 + quality * 1.1 + cheer * 2;
    }

    // Halo under the one object that can be picked up, brighter and turning
    // faster once a hand is close enough to actually grab it.
    const halo = haloRef.current;
    if (halo) {
      halo.visible = !held;
      halo.position.set(game.pos.x, game.pos.y, REST_Z - 0.09);
      const beat = game.near ? 1.14 : 1 + Math.sin(time * 3) * 0.06;
      halo.scale.setScalar(beat);
      halo.rotation.z = time * (game.near ? 1.4 : 0.35);
      const material = halo.material as MeshStandardMaterial;
      material.emissiveIntensity = game.near ? 1.8 : 0.6;
    }

    // Dots arcing from the object toward its destination: the whole
    // instruction, readable without words.
    const showHint = stage.kind === "place" && !held;
    for (let i = 0; i < HINT_DOTS; i++) {
      const dot = hintRefs.current[i];
      if (!dot) continue;
      dot.visible = showHint;
      if (!showHint) continue;
      const t = (i / HINT_DOTS + time * 0.35) % 1;
      const fade = Math.sin(t * Math.PI);
      dot.position.set(
        game.pos.x + (stage.target[0] - game.pos.x) * t,
        game.pos.y + (stage.target[1] - game.pos.y) * t,
        REST_Z + 0.04 + fade * 0.3,
      );
      dot.scale.setScalar(0.06 + fade * 0.08);
    }

    // Liquid standing in the vessel, with its crema riding on the surface.
    const level = pours ? clamp01(game.amount) : 0;
    const surface = vessel.base + level * vessel.height;
    const fill = fillRef.current;
    if (fill) {
      fill.visible = level > 0.01;
      fill.scale.y = Math.max(level, 1e-3);
      fill.position.z = vessel.base + (level * vessel.height) / 2;
    }
    // The surface rides on top of whatever is in the vessel, and is where all
    // the movement happens.
    const top = surfaceRef.current;
    if (top) {
      top.visible = level > 0.02;
      top.position.z = surface + 0.01;
    }

    // Run the water, and dent it where the stream is landing. The dent is
    // thrown in a few times a second rather than every frame: a continuous
    // push just holds the surface down instead of making rings.
    stepSlosh(sloshRef.current, dt, 0.3, 0.05);
    if (working > 0.02 && stage.kind === "tilt") {
      game.dripAt += dt;
      if (game.dripAt > 0.09) {
        game.dripAt = 0;
        // Where the stream comes down, in the surface's own -1..1 coordinates.
        const hitX = (game.pos.x - stage.target[0]) / Math.max(vessel.radius, 1e-3);
        const hitY = (game.pos.y - stage.target[1]) / Math.max(vessel.radius, 1e-3);
        splash(
          sloshRef.current,
          Math.max(-0.7, Math.min(0.7, hitX)),
          Math.max(-0.7, Math.min(0.7, hitY)),
          0.5 + working * 0.7,
          2.1,
        );
      }
    }
    for (let i = 0; i < 2; i++) {
      const band = bandRefs.current[i];
      if (!band) continue;
      const edge = stage.band?.[i];
      band.visible = pours && edge !== undefined;
      if (edge !== undefined) {
        band.position.z = vessel.base + edge * vessel.height;
      }
    }

    // Steam only once there is something hot to come off, thickening as the cup
    // fills. Eased, so it never appears out of nowhere.
    steamRef.current = approach(
      steamRef.current,
      pours ? level * (0.45 + working * 0.55) : 0,
      3,
      dt,
    );
    // The grounds jump while they are being worked.
    game.churn = approach(game.churn, working, 8, dt);
    churnRef.current = game.churn;

    // The stream runs from the lip of whatever is being tipped down into
    // whatever is underneath it, so it leans as the hand leans.
    const streaming = stage.kind === "tilt" ? working : 0;
    flowRef.current = approach(flowRef.current, streaming, 14, dt);
    // The lip, not the middle: a stream starting inside the vessel is hidden
    // by the vessel. Tipping turns the spout toward +x, so that is where it
    // leaves from.
    spoutRef.current.set(
      game.pos.x + 1.05,
      game.pos.y - 0.2,
      game.lift.value - 0.05,
    );
    basinRef.current.set(stage.target[0], stage.target[1], surface);
    spillRef.current = game.spilled;

    if (game.changed || time - game.publishAt > PUBLISH_INTERVAL) {
      game.publishAt = time;
      game.changed = false;
      onStatus({
        index: game.stage,
        total: stages.length,
        title: stage.title,
        instruction: stage.instruction,
        progress,
        detail: readout(stage, game),
        quality,
        holding: held,
        near: game.near,
        marks: game.published,
        hurry: game.elapsed > limit - HURRY_AT,
        done: false,
      });
    }
  });

  const key = `${recipe.id}-${view}`;

  return (
    <group ref={sceneRef}>
      {/* Destination ring, unit sized and scaled per stage */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1, 0.055, 12, 48]} />
        <meshStandardMaterial
          roughness={0.35}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>

      {/* "Grab this" halo — six-sided, so its turning reads as turning */}
      <mesh ref={haloRef}>
        <torusGeometry args={[0.74, 0.03, 8, 6]} />
        <meshStandardMaterial
          color="#ffdca8"
          emissive="#f0b429"
          emissiveIntensity={0.6}
          roughness={0.4}
          toneMapped={false}
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
            emissiveIntensity={0.9}
            roughness={0.4}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Stage scenery, straight from the recipe: what it sits on, what the
          liquid goes into, and a mat marking where to reach for the object. */}
      <Prop key={`sits-${key}`} kind={shown.sits} position={shown.target} />
      {shown.vessel && (
        <Prop
          key={`vessel-${key}`}
          kind={shown.vessel}
          position={shown.target}
        />
      )}
      {shown.kind !== "crank" && (
        <Prop key={`mat-${key}`} kind="mat" position={shown.item} />
      )}

      <group position={[shown.target[0], shown.target[1], 0]}>
        <Level
          fillRef={fillRef}
          surfaceRef={surfaceRef}
          bandRefs={bandRefs}
          slosh={sloshRef}
          radius={vessel.radius}
          height={vessel.height}
          look={liquid}
        />
        <Steam amount={steamRef} position={[0, 0, vessel.base + 0.34]} />
        {/* What went over the rim, left on the counter where it landed. */}
        <Spill
          amount={spillRef}
          position={[0, -0.2, REST_Z - 0.09]}
          colour={liquid.colour}
        />
        {/* Grounds in the bottom of the mortar, jumping as they are worked. */}
        {shown.kind === "crank" && (
          <Beans
            position={[0, 0, 0.34]}
            radius={0.62}
            count={26}
            shake={churnRef}
            colour={GROUNDS}
          />
        )}
      </group>

      {/* The one object the player can hold this stage */}
      <group ref={itemRef}>
        <Prop key={`holds-${key}`} kind={shown.holds} />
        {shown.holds === "scoop" && (
          <Beans position={[0.18, 0, 0.1]} radius={0.26} count={14} />
        )}
      </group>

      {/* The pour itself, falling from the lip to the surface below it. */}
      <PourStream
        flow={flowRef}
        from={spoutRef}
        to={basinRef}
        colour={liquid.colour}
      />

      <Burst firedAt={cheeredAtRef} origin={cheerOriginRef} />
    </group>
  );
}
