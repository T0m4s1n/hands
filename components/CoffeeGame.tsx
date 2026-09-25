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
  BeanSpill,
  Burst,
  GroundDust,
  LatteArt,
  PourImpact,
  PourStream,
  Spill,
  Steam,
} from "@/components/coffee/effects";
import { crowdMood } from "@/components/coffee/crowd";
import { KIT } from "@/components/coffee/kit";
import {
  LIQUIDS,
  pour,
  type LiquidKind,
} from "@/components/coffee/liquid";
import {
  canCommitRelease,
  carryShouldHold,
  crankShouldHold,
  releaseReason,
} from "@/components/coffee/interactionState";
import {
  finishSettlement,
  requestSettlement,
} from "@/components/coffee/settlement";
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
  crankHandIsLive,
  driveCrank,
  newStroke,
  newTurn,
  palmAngle,
  pourFlow,
  updateStroke,
  type StrokeState,
  type TurnState,
} from "@/components/coffee/gestures";
import {
  writeGloveHold,
  type GloveHold,
} from "@/components/coffee/gloveGrip";
import {
  bandScore,
  type Recipe,
  type Stage,
} from "@/components/coffee/recipes";
import {
  crankGrabReach,
  overStation,
  stageStation,
  stationQuality,
} from "@/components/coffee/station";
import {
  DRIPPER,
  GROUP,
  brewAt,
  dripperPark,
  dripperSeatZ,
  dripperVessel,
  usesDripper,
  usesGroup,
} from "@/components/coffee/leftover";
import {
  DUMP_DWELL,
  dumpAmount,
  dumpMouth,
  dumpReleases,
  scoopDumpPose,
} from "@/components/coffee/beanDump";
import {
  TAMP_DWELL_S,
  TAMP_GAP_S,
  tampAmount,
  tampHits,
  tampPose,
  tampBusyOnStage,
} from "@/components/coffee/tampPress";
import { destinationOf } from "@/components/flow/playCopy";
import { CRANK_ARM, CREMA, GROUNDS, Level, Prop } from "@/components/coffee/props";
import { playSfx, setWorkLoop, type WorkLoop } from "@/lib/audio";

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
  /** True while a pour/grind/shake is actively scoring this frame. */
  working: boolean;
  done: boolean;
};

/** Reach matches the locked glove size — not the MediaPipe image span. */
const GRAB_RADIUS = 1.88;
/** The mill is a bigger target so the player does not lean into the lens. */
const CRANK_GRAB_RADIUS = 2.15;
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
 *
 * Raised once the stream stopped being a line of beads and became a tube.
 * At the old height the spout sat almost on the brewer's rim and the pour had
 * nothing to fall through, which on screen is a smear between two objects. A
 * pour nobody can see teaches nobody how to pour, and this is the one stage
 * whose whole lesson is in the stream.
 *
 * Note this is a floor and not the height itself: `carryOver` already lifts a
 * carried thing clear of whatever it is over, and for the brewer that lands
 * near 1.6 on its own. Raising this from 1.15 to 1.7 therefore bought about
 * nine hundredths of a unit and looked identical — the number has to clear
 * what the collision rule was already doing before it changes anything.
 */
const POUR_LIFT_Z = 2.35;
const RING_Z = 0.05;
const CRANK_Z = 0.95;
const PUBLISH_INTERVAL = 0.08;
const HINT_DOTS = 7;

/**
 * How far the hand has to travel for a shake to count as one. Small enough
 * to be comfortable, large enough that tracking jitter never reaches it.
 */
const SHAKE_THROW = 0.45;
/** Height the mallet works from — slam pose is added on top of this. */
const TAMP_REST_Z = 0.5;

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
    /** Gesture amount for non-liquid stages. Liquid lives only in volumes. */
    amount: 0,
    /** Source of truth for liquid visuals, HUD and scoring. */
    sourceVolume: 1.2,
    destinationVolume: 0,
    /** Pestle angle round the mortar, and how far it has been turned. */
    angle: 0,
    turn: null as TurnState | null,
    /** Back-and-forth counter, for shaking and pressing. */
    stroke: null as StrokeState | null,
    /** Side-to-side wiggles while pouring a heart. */
    flourish: 0,
    artStroke: null as StrokeState | null,
    /** How the palm sat when the object was picked up, and the roll since. */
    grabAngle: 0,
    tilt: 0,
    intro: 0,
    holder: null as Handedness | null,
    near: false,
    wasGrabbing: { Left: false, Right: false } as Record<Handedness, boolean>,
    /** Scoop / filter still shows its heap until a successful dump. */
    cargoLoaded: true,
    spillAt: -99,
    dumping: false,
    dumpElapsed: 0,
    dumpDwell: 0,
    dumpMark: 0,
    tamping: false,
    tampElapsed: 0,
    tampHit: false,
    tampDwell: 0,
    pos: new Vector3(first.item[0], first.item[1], REST_Z),
    done: false,
    publishAt: -1,
    changed: true,
    lifecycle: "active" as "active" | "settling",
    settleUntil: -1,
    pendingMark: 0,

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
    wasPouring: false,

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
    /** Scene time the crank holder vanished — 0 while the hand is published. */
    crankLostAt: -1,
    /** Scene time the crank fist read open — 0 while it is still shut. */
    crankOpenAt: -1,

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
function hasCargoDump(stage: Stage): boolean {
  return stage.kind === "place" && Boolean(KIT[stage.holds]?.cargo);
}

function handObjectDistance(hand: TrackedHand, x: number, y: number): number {
  let best = flatDistance(hand.cursor.x, hand.cursor.y, x, y);
  const probes = hand.grabPoints ?? handGrabPoints(hand.smoothedLandmarks);
  for (const point of probes) {
    best = Math.min(best, flatDistance(point.x, point.y, x, y));
  }
  return best;
}

/** The mark this attempt stands at right now, which is also the ring's colour. */
function currentQuality(stage: Stage, game: GameState): number {
  if (stage.band) {
    const fill = bandScore(stageAmount(stage, game), stage.band);
    if (stage.flourish === "heart") {
      const art = Math.min(1, Math.max(0, (game.flourish - 2) / 8));
      return fill * 0.62 + art * 0.38;
    }
    return fill;
  }
  const reach = flatDistance(
    game.pos.x,
    game.pos.y,
    stage.target[0],
    stage.target[1],
  );
  return stationQuality(reach, stageStation(stage.kind, stage.sits));
}

function stageAmount(stage: Stage, game: GameState): number {
  return stage.kind === "hold" || stage.kind === "tilt"
    ? game.destinationVolume
    : game.amount;
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
      return `${Math.round(game.destinationVolume * 100)} % lleno`;
    case "tamp":
      return `${Math.round(game.amount)} de ${stage.goal} prensadas`;
    case "shake":
      return `${Math.round(game.amount)} de ${stage.goal} sacudidas`;
    case "place":
      // Only worth saying while it is actually in hand.
      return game.holder
        ? `suelta sobre ${destinationOf(stage.sits)}`
        : "";
  }
}

export function CoffeeGame({
  recipe,
  handsRef,
  holdRef,
  onStatus,
  round,
  running,
  showGuides = true,
}: {
  recipe: Recipe;
  handsRef: RefObject<TrackedHand[]>;
  holdRef?: RefObject<GloveHold>;
  onStatus: (status: StageStatus) => void;
  /** bump to start a fresh brew */
  round: number;
  /**
   * False while a menu is up. The table stays on screen behind it, so without
   * this the stage clock would run against a player who is not even playing.
   */
  running: boolean;
  /** Rings and halos follow the same phase policy as the HUD. */
  showGuides?: boolean;
}) {
  const [view, setView] = useState(0);
  const [cargoOn, setCargoOn] = useState(true);
  const [spillLook, setSpillLook] = useState({
    count: 12,
    colour: "#3b1f10",
  });
  const stateRef = useRef<GameState | null>(null);
  const sceneRef = useRef<Group>(null);
  const itemRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const fillRef = useRef<Mesh>(null);
  const surfaceRef = useRef<Mesh>(null);
  const sourceFillRef = useRef<Mesh>(null);
  const sourceSurfaceRef = useRef<Mesh>(null);
  const bandRefs = useRef<(Mesh | null)[]>([]);
  const hintRefs = useRef<(Mesh | null)[]>([]);

  // Read by the effects every frame, written by the game loop, so neither one
  // has to re-render the other.
  const steamRef = useRef(0);
  const churnRef = useRef(0);
  const flowRef = useRef(0);
  const spoutRef = useRef(new Vector3());
  const spoutBRef = useRef(new Vector3());
  const basinRef = useRef(new Vector3());
  const spillRef = useRef(0);
  // The wave simulation for whatever is being filled. It lives here because
  // the game is what disturbs it; the surface only draws what it finds.
  const sloshRef = useRef(createSlosh(16));
  const cheeredAtRef = useRef(-99);
  const cheerOriginRef = useRef(new Vector3());
  const spillAtRef = useRef(-99);
  const spillFromRef = useRef(new Vector3());
  const spillToRef = useRef(new Vector3());
  const cargoLoadedRef = useRef(true);
  const jostleRef = useRef(0);
  const artRef = useRef(0);
  const lastCarryRef = useRef(new Vector3());
  const heardRef = useRef({
    near: false,
    hurry: false,
    lock: false,
    heart: 0,
    work: null as WorkLoop,
    steam: false,
  });

  const stages = recipe.stages;
  const shown = stages[Math.min(view, stages.length - 1)];
  const vesselKind = shown.vessel ?? shown.sits;
  const vessel = usesDripper(shown)
    ? dripperVessel(KIT[vesselKind]?.vessel ?? KIT.mug!.vessel!)
    : (KIT[vesselKind]?.vessel ?? KIT.mug!.vessel!);
  const sourceVessel = KIT[shown.holds]?.vessel;
  const pours = shown.kind === "hold" || shown.kind === "tilt";
  const liquid = LIQUIDS[(shown.liquid ?? "coffee") as LiquidKind];
  const cupAt = brewAt(shown);

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
      if (sourceFillRef.current) sourceFillRef.current.visible = false;
      if (sourceSurfaceRef.current) sourceSurfaceRef.current.visible = false;
      for (const band of bandRefs.current) if (band) band.visible = false;
      for (const dot of hintRefs.current) if (dot) dot.visible = false;
      steamRef.current = 0;
      churnRef.current = 0;
      flowRef.current = 0;
      spillRef.current = 0;
      if (heardRef.current.work) {
        heardRef.current.work = null;
        setWorkLoop(null);
      }
      writeGloveHold(holdRef?.current, null);
      return;
    }

    const game = (stateRef.current ??= createGameState(recipe, round));
    const hands = handsRef.current ?? [];
    spillAtRef.current = game.spillAt;
    if (cargoLoadedRef.current !== game.cargoLoaded) {
      cargoLoadedRef.current = game.cargoLoaded;
      setCargoOn(game.cargoLoaded);
    }

    if (game.round !== round || game.recipeId !== recipe.id) {
      stateRef.current = createGameState(recipe, round);
      cargoLoadedRef.current = true;
      setCargoOn(true);
      setView(0);
      writeGloveHold(holdRef?.current, null);
      return;
    }

    if (game.done) {
      // The coffee is made: the markers have nothing left to point at, and the
      // only thing still moving is the steam off a finished cup.
      if (ringRef.current) ringRef.current.visible = false;
      if (haloRef.current) haloRef.current.visible = false;
      for (const dot of hintRefs.current) if (dot) dot.visible = false;
      steamRef.current = approach(steamRef.current, 0.85, 2, dt);
      if (heardRef.current.work) {
        heardRef.current.work = null;
        setWorkLoop(null);
      }
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
          working: false,
          done: true,
        });
      }
      writeGloveHold(holdRef?.current, null);
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
      if (!requestSettlement(game, mark)) return;
      playSfx("stage");
      playSfx("cheer");
      heardRef.current.work = null;
      setWorkLoop(null);
      game.settleUntil = time + 0.62;
      game.holder = null;
      game.changed = true;
      // Praise lands where the work happened, not at some fixed spot.
      cheerOriginRef.current.set(stage.target[0], stage.target[1], REST_Z + 0.4);
      cheeredAtRef.current = time;
      game.cheeredAt = time;
      // And the room joins in.
      crowdMood.cheerAt = time;
      game.swell.velocity += 2.2;
      flowRef.current = 0;
    };

    const beginDump = (mark: number) => {
      if (game.dumping || !game.cargoLoaded) return;
      game.dumping = true;
      game.dumpElapsed = 0;
      game.dumpMark = mark;
      game.changed = true;
      playSfx("whoosh");
    };

    const beginTamp = () => {
      if (game.tamping) return;
      game.tamping = true;
      game.tampElapsed = 0;
      game.tampHit = false;
      game.changed = true;
      playSfx("whoosh");
    };

    const tampGoal = stage.kind === "tamp" ? stage.goal : 3;
    let tampDust = 0;

    if (game.dumping) {
      game.dumpElapsed += dt;
      const amount = dumpAmount(game.dumpElapsed);
      const dumpAt = dripperPark(stage, stage.target);
      game.pos.x = approach(game.pos.x, dumpAt[0], 12, dt);
      game.pos.y = approach(game.pos.y, dumpAt[1], 12, dt);
      const dumpPark = dripperSeatZ(
        stage,
        flatDistance(game.pos.x, game.pos.y, stage.target[0], stage.target[1]),
        stageStation(stage.kind, stage.sits).mouth,
        game.lift.value,
      );
      if (dumpPark !== game.lift.value) {
        game.lift.value = approach(game.lift.value, dumpPark + 0.16, 10, dt);
      }
      if (dumpReleases(amount) && game.cargoLoaded && KIT[stage.holds]?.cargo) {
        const cargo = KIT[stage.holds]!.cargo!;
        game.cargoLoaded = false;
        game.spillAt = time;
        const mouth = dumpMouth(
          {
            x: game.pos.x,
            y: game.pos.y,
            z: game.lift.value,
          },
          scoopDumpPose(amount),
        );
        spillFromRef.current.set(mouth.x, mouth.y, mouth.z);
        spillToRef.current.set(
          stage.target[0],
          stage.target[1],
          usesDripper(stage) ? DRIPPER.bed : REST_Z + 0.28,
        );
        setSpillLook({
          count: cargo.count ?? 18,
          colour: cargo.colour ?? "#3b1f10",
        });
        playSfx("clink");
      }
      if (amount >= 1) {
        game.dumping = false;
        commit(game.dumpMark);
        return;
      }
    }

    if (stage.kind === "tamp" && game.tamping) {
      const prev = tampAmount(game.tampElapsed);
      game.tampElapsed += dt;
      const amount = tampAmount(game.tampElapsed);
      const strike = game.tampHit ? Math.max(0, game.amount - 1) : game.amount;
      const press = tampPose(amount, strike);
      game.pos.x = approach(game.pos.x, stage.target[0], 12, dt);
      game.pos.y = approach(game.pos.y, stage.target[1], 12, dt);
      game.rideHeight = TAMP_REST_Z;
      tampDust = press.dust;
      if (tampHits(prev, amount) && !game.tampHit) {
        game.tampHit = true;
        game.amount += 1;
        game.grow.velocity -= strike >= 2 ? 12 : 8;
        game.swell.velocity += strike >= 2 ? 2.2 : 1.5;
        playSfx("tamp");
        playSfx("clink");
      }
      if (amount >= 1) {
        game.tamping = false;
        game.tampElapsed = 0;
        game.tampHit = false;
        game.tampDwell = -TAMP_GAP_S;
        if (game.amount >= tampGoal) {
          commit(bandScore(game.amount, stage.band ?? [2, 4]));
          return;
        }
      }
    } else if (
      stage.kind === "tamp" &&
      game.amount > 0 &&
      game.amount < tampGoal
    ) {
      game.tampDwell += dt;
      if (game.tampDwell >= TAMP_DWELL_S) beginTamp();
    }

    if (game.lifecycle === "settling") {
      const settleAt = dripperPark(stage, stage.target);
      game.pos.x = approach(game.pos.x, settleAt[0], 8, dt);
      game.pos.y = approach(game.pos.y, settleAt[1], 8, dt);
      const park = dripperSeatZ(
        stage,
        flatDistance(game.pos.x, game.pos.y, stage.target[0], stage.target[1]),
        stageStation(stage.kind, stage.sits).mouth,
        REST_Z,
      );
      stepSpring(game.lift, park, 95, dt, 0.2);
      stepSpring(game.grow, 1.04, 140, dt, 0.45);
      if (itemRef.current) {
        itemRef.current.position.set(game.pos.x, game.pos.y, game.lift.value);
        itemRef.current.scale.setScalar(Math.max(game.grow.value, 0.05));
        itemRef.current.rotation.x = approach(
          itemRef.current.rotation.x,
          0,
          10,
          dt,
        );
        itemRef.current.rotation.y = approach(
          itemRef.current.rotation.y,
          0,
          10,
          dt,
        );
        itemRef.current.rotation.z = approach(
          itemRef.current.rotation.z,
          0,
          10,
          dt,
        );
      }
      if (ringRef.current) ringRef.current.visible = false;
      if (haloRef.current) haloRef.current.visible = false;
      for (const dot of hintRefs.current) if (dot) dot.visible = false;

      if (game.changed || time - game.publishAt > PUBLISH_INTERVAL) {
        game.publishAt = time;
        game.changed = false;
        onStatus({
          index: game.stage,
          total: stages.length,
          title: stage.title,
          instruction: "Bien puesto — preparando el siguiente paso",
          progress: 1,
          detail: "Asentando…",
          quality: game.pendingMark,
          holding: false,
          near: false,
          marks: game.published,
          hurry: false,
          working: false,
          done: false,
        });
      }
      if (time < game.settleUntil) {
        writeGloveHold(holdRef?.current, null);
        return;
      }

      const settledMark = finishSettlement(game);
      if (settledMark === null) {
        writeGloveHold(holdRef?.current, null);
        return;
      }
      game.marks.push(settledMark);
      game.published = [...game.marks];
      game.stage += 1;
      game.amount = 0;
      game.sourceVolume = 1.2;
      game.destinationVolume = 0;
      game.angle = 0;
      game.turn = null;
      game.stroke = null;
      game.flourish = 0;
      game.artStroke = null;
      game.tilt = 0;
      game.elapsed = 0;
      game.touched = false;
      game.intro = 0;
      game.holder = null;
      game.changed = true;
      game.cargoLoaded = true;
      game.dumping = false;
      game.dumpElapsed = 0;
      game.dumpDwell = 0;
      game.tamping = false;
      game.tampElapsed = 0;
      game.tampHit = false;
      game.tampDwell = 0;
      calmSlosh(sloshRef.current);
      game.spilled = 0;
      game.overflowing = 0;
      game.wasPouring = false;
      game.settleUntil = -1;
      if (game.stage >= stages.length) {
        game.done = true;
      } else {
        const next = stages[game.stage];
        game.pos.set(next.item[0], next.item[1], REST_Z);
        setSpring(game.lift, REST_Z);
        // The next stage's object drops in rather than appearing.
        setSpring(game.grow, 0.55);
        setView(game.stage);
        playSfx("land");
        heardRef.current = {
          near: false,
          hurry: false,
          lock: false,
          heart: 0,
          work: null,
          steam: false,
        };
      }
      writeGloveHold(holdRef?.current, null);
      return;
    }

    // Only the current stage's object can be picked up, so there is never a
    // question about what to reach for.
    let near = false;
    let nearHand: Handedness | null = null;
    let nearReach = Infinity;
    let working = 0;
    let holderIsLive = false;
    const tampBusy = tampBusyOnStage(
      stage.kind,
      game.tamping,
      game.amount,
      tampGoal,
    );
    if (game.dumping) {
      near = true;
      nearHand = game.holder;
      working = 1;
      holderIsLive = true;
    }
    if (tampBusy) {
      near = true;
      nearHand = game.holder ?? nearHand;
      working = Math.max(working, 0.45 + tampDust * 0.55);
      holderIsLive = true;
    }
    if (!game.dumping && !tampBusy) {
    for (const handedness of ["Left", "Right"] as const) {
      const hand = hands.find((item) => item.handedness === handedness);
      if (!hand) {
        game.wasGrabbing[handedness] = false;
        continue;
      }
      const handleDist = handObjectDistance(hand, game.pos.x, game.pos.y);
      const reach =
        stage.kind === "crank"
          ? crankGrabReach(
              handleDist,
              handObjectDistance(hand, stage.target[0], stage.target[1]),
            )
          : handleDist;
      const grabAt = stage.kind === "crank" ? CRANK_GRAB_RADIUS : GRAB_RADIUS;
      if (reach < grabAt && reach < nearReach) {
        near = true;
        nearHand = handedness;
        nearReach = reach;
      }

      const grabbing = hand.isGrabbing;
      if (grabbing && !game.wasGrabbing[handedness] && !game.holder) {
        if (reach < grabAt) {
          playSfx("grab");
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
            // Keep the pestle where it is. Snapping to the hand's angle is
            // what teleported the mill when a wrist re-entered the frame.
            game.turn = newTurn(game.angle);
            game.turn.turned = game.amount;
            game.crankLostAt = -1;
            game.crankOpenAt = -1;
          }
          if (stage.kind === "shake") game.stroke = newStroke(hand.cursor.x);
        }
      }
      game.wasGrabbing[handedness] = grabbing;
    }
    game.near = near;
    if (near && !heardRef.current.near && !game.holder) {
      heardRef.current.near = true;
      playSfx("near");
    }
    if (!near) heardRef.current.near = false;

    const holder = game.holder
      ? hands.find((item) => item.handedness === game.holder)
      : undefined;
    // Coasting is still a live hold. A blink must not drop the cup.
    holderIsLive = Boolean(holder);
    let release = releaseReason(
      game.holder !== null,
      holderIsLive,
      Boolean(holder?.isGrabbing),
    );
    if ((stage.kind === "crank" || stage.kind === "tamp") && game.holder) {
      if (holder) {
        game.crankLostAt = -1;
        if (holder.isGrabbing) game.crankOpenAt = -1;
        else if (game.crankOpenAt < 0) game.crankOpenAt = time;
      } else if (game.crankLostAt < 0) {
        game.crankLostAt = time;
      }
      const lostS = game.crankLostAt < 0 ? 0 : time - game.crankLostAt;
      const openS = game.crankOpenAt < 0 ? 0 : time - game.crankOpenAt;
      const grabAt = stage.kind === "crank" ? CRANK_GRAB_RADIUS : GRAB_RADIUS;
      const away = holder
        ? (stage.kind === "crank"
            ? crankGrabReach(
                handObjectDistance(holder, game.pos.x, game.pos.y),
                handObjectDistance(
                  holder,
                  stage.target[0],
                  stage.target[1],
                ),
              )
            : handObjectDistance(holder, game.pos.x, game.pos.y)) > grabAt
        : false;
      if (
        crankShouldHold(
          Boolean(holder),
          Boolean(holder?.isGrabbing),
          lostS,
          openS,
          away,
        )
      ) {
        release = "none";
        holderIsLive = true;
      }
    } else if (game.holder) {
      game.crankOpenAt = -1;
      if (holder) game.crankLostAt = -1;
      else if (game.crankLostAt < 0) game.crankLostAt = time;
      const lostS = game.crankLostAt < 0 ? 0 : time - game.crankLostAt;
      if (carryShouldHold(Boolean(holder), lostS)) {
        release = "none";
        holderIsLive = true;
      }
    } else {
      game.crankLostAt = -1;
      game.crankOpenAt = -1;
    }
    const released = release !== "none";

    if (
      holder &&
      hasCargoDump(stage) &&
      game.cargoLoaded &&
      overStation(
        flatDistance(game.pos.x, game.pos.y, stage.target[0], stage.target[1]),
        stageStation(stage.kind, stage.sits),
      )
    ) {
      game.dumpDwell += dt;
      if (game.dumpDwell >= DUMP_DWELL) {
        beginDump(
          stationQuality(
            flatDistance(
              game.pos.x,
              game.pos.y,
              stage.target[0],
              stage.target[1],
            ),
            stageStation(stage.kind, stage.sits),
          ),
        );
      }
    } else {
      game.dumpDwell = 0;
    }

    if (holder && holderIsLive && !released && !game.dumping && !game.tamping) {
      if (stage.kind === "crank") {
        if (crankHandIsLive(holder) && holder.isGrabbing) {
          const angle = Math.atan2(
            holder.cursor.y - stage.target[1],
            holder.cursor.x - stage.target[0],
          );
          const turn = (game.turn ??= newTurn(game.angle));
          const moved = driveCrank(turn, angle, dt);
          working = clamp01(moved / Math.max(dt, 1e-3) / 6);
          game.angle = turn.angle;
          game.amount = turn.turned;
        }
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
        const station = stageStation(stage.kind, stage.sits);
        const inside = overStation(reach, station);

        if (stage.kind === "hold") {
          if (inside) {
            const result = pour({
              from: game.sourceVolume,
              into: game.destinationVolume,
              room: 1,
              amount: (stage.rate ?? 0.4) * dt,
            });
            game.sourceVolume = result.from;
            game.destinationVolume = result.into;
            game.spilled += result.spilled;
            working = result.moved + result.spilled > 0 ? 1 : 0;
          }
        } else if (stage.kind === "tilt") {
          const wanted = angleDelta(
            game.grabAngle,
            holder.roll ?? palmAngle(holder.smoothedLandmarks),
          );
          game.tilt = approach(game.tilt, wanted, 12, dt);
          const flow = pourFlow(game.tilt);
          if (inside) {
            const result = pour({
              from: game.sourceVolume,
              into: game.destinationVolume,
              room: 1,
              amount: flow * (stage.rate ?? 0.4) * dt,
            });
            game.sourceVolume = result.from;
            game.destinationVolume = result.into;
            game.spilled += result.spilled;
            working = result.moved + result.spilled > 0 ? flow : 0;
            if (stage.flourish === "heart" && working > 0.08) {
              const art = (game.artStroke ??= newStroke(holder.cursor.x));
              updateStroke(art, holder.cursor.x, 0.14);
              game.flourish = art.count;
            }
          }
        } else if (stage.kind === "shake") {
          const stroke = (game.stroke ??= newStroke(holder.cursor.x));
          updateStroke(stroke, holder.cursor.x, SHAKE_THROW);
          game.amount = stroke.count;
          working = 1;
        } else if (stage.kind === "tamp") {
          game.rideHeight = TAMP_REST_Z;
          if (inside) {
            game.tampDwell += dt;
            if (game.tampDwell >= TAMP_DWELL_S) beginTamp();
          } else if (game.tampDwell > 0) {
            game.tampDwell = 0;
          }
        }
      }

      // Past the brim it goes on the counter. Cutting the stage off the instant
      // it filled hid the mistake; letting it run over shows the player what
      // they did, and the puddle stays there afterwards.
      if (pours && game.destinationVolume >= 1 && working > 0) {
        const over = game.destinationVolume - 1;
        game.destinationVolume = 1;
        game.spilled += over;
        if (game.overflowing === 0) playSfx("splash");
        game.overflowing += dt;
        if (game.overflowing > OVERFLOW_GRACE) {
          commit(bandScore(1, stage.band ?? [1, 1]));
          return;
        }
      }
    }

    if (released && !game.tamping) {
      const reach = flatDistance(
        game.pos.x,
        game.pos.y,
        stage.target[0],
        stage.target[1],
      );
      const station = stageStation(stage.kind, stage.sits);
      if (
        stage.kind === "place" &&
        overStation(reach, station) &&
        hasCargoDump(stage) &&
        game.cargoLoaded
      ) {
        beginDump(stationQuality(reach, station));
      } else {
      playSfx("drop");
      game.holder = null;
      game.changed = true;
      if (overStation(reach, station)) playSfx("clink");
      if (release === "tracking-lost") {
        // A camera blink is not an attempt. Put the prop down and keep the
        // accumulated work so the player can safely re-grab it.
        game.lift.velocity = -Math.abs(game.lift.velocity) - 1.2;
        flowRef.current = 0;
      } else if (stage.kind === "place") {
        if (overStation(reach, station)) {
          commit(stationQuality(reach, station));
          return;
        }
        // Dropped short: it stays where it fell, set down on whatever is under
        // it, and can be picked up again. It is never left in mid-air.
        game.lift.velocity = -Math.abs(game.lift.velocity) - 1.2;
      } else if (
        canCommitRelease(release, stageAmount(stage, game), MIN_EFFORT)
      ) {
        commit(currentQuality(stage, game));
        return;
      }
      }
    }
    }

    // Out of time: the stage is marked as it stands and the brew carries on.
    const limit = game.touched ? STAGE_LIMIT : IDLE_LIMIT;
    if (!game.dumping && !tampBusy && game.elapsed > limit) {
      commit(currentQuality(stage, game));
      return;
    }

    // ---- draw ----
    const quality = currentQuality(stage, game);
    const progress =
      stage.kind === "place"
        ? quality
        : clamp01(stageAmount(stage, game) / Math.max(stage.goal, 1e-4));
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
      restingHeight = dripperSeatZ(
        stage,
        flatDistance(game.pos.x, game.pos.y, stage.target[0], stage.target[1]),
        stageStation(stage.kind, stage.sits).mouth,
        restingHeight,
      );
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
      if (pours && game.destinationVolume > 0.02) {
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
      if (game.dumping) {
        const pour = scoopDumpPose(dumpAmount(game.dumpElapsed));
        item.position.set(
          game.pos.x,
          game.pos.y,
          game.lift.value + pour.lift,
        );
        item.rotation.set(pour.roll * 0.18, pour.roll, pour.twist);
      } else if (stage.kind === "crank") {
        // The pestle leans into the circle it is being swung round.
        item.rotation.z = game.angle + Math.PI / 2;
        item.rotation.x = 0.3 + working * 0.14;
      } else if (stage.kind === "tilt") {
        // Rolling the wrist either way tips the spout down, so the object
        // always agrees with what the hand is doing.
        item.rotation.y = Math.min(Math.abs(game.tilt), 1.25);
        if (!held) item.rotation.z = Math.sin(time * 1.1) * 0.06;
      } else if (stage.kind === "shake" && held) {
        // The jar itself has to move or a counted shake reads as a number
        // going up for no reason.
        const shake = 0.12 + working * 0.22;
        item.rotation.z = Math.sin(time * 16) * shake;
        item.rotation.x = Math.sin(time * 13.4) * shake * 0.45;
      } else if (game.tamping) {
        const strike = game.tampHit ? Math.max(0, game.amount - 1) : game.amount;
        const press = tampPose(tampAmount(game.tampElapsed), strike);
        item.position.set(
          game.pos.x,
          game.pos.y,
          game.lift.value + press.lift,
        );
        item.rotation.set(press.pitch, press.twist * 0.22, press.twist);
        item.scale.setScalar(
          Math.max(game.grow.value, 0.05) * (1 - press.squash * 0.12),
        );
      } else if (stage.kind === "tamp" && held) {
        item.position.z += 0.1 + Math.sin(time * 5.2) * 0.035;
        item.rotation.x = 0.1;
        item.rotation.z = Math.sin(time * 3.1) * 0.05;
      } else if (stage.kind === "hold" && held) {
        const locked = overStation(
          flatDistance(
            game.pos.x,
            game.pos.y,
            stage.target[0],
            stage.target[1],
          ),
          stageStation(stage.kind, stage.sits),
        );
        if (locked && usesGroup(stage)) {
          // Seat under the group — the pan does not rest on the machine.
          item.position.set(
            stage.target[0] + GROUP.lock[0],
            stage.target[1] + GROUP.lock[1],
            GROUP.lock[2],
          );
          item.rotation.set(0.08, 0, 0.1);
        } else {
          item.rotation.z = locked ? 0.55 : 0.12;
          item.position.z += locked ? 0.08 : 0;
        }
      } else if (!held) {
        item.rotation.z = Math.sin(time * 1.1) * 0.06;
      }
    }

    const ring = ringRef.current;
    if (ring) {
      ring.visible = showGuides;
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
      const station = stageStation(stage.kind, stage.sits);
      ring.scale.setScalar(station.mouth * (1 + beat + cheer * 0.22));
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
      halo.visible = showGuides && !held;
      halo.position.set(game.pos.x, game.pos.y, REST_Z - 0.09);
      const beat = game.near ? 1.22 : 1 + Math.sin(time * 3) * 0.06;
      halo.scale.setScalar(beat);
      halo.rotation.z = time * (game.near ? 1.8 : 0.35);
      const material = halo.material as MeshStandardMaterial;
      material.emissiveIntensity = game.near ? 2.4 : 0.6;
    }

    // Dots that say what to do without words: an arc toward the mark, or a
    // circle around the mortar. Hidden once the object is already there —
    // a path to somewhere you are standing is noise.
    const reachNow = flatDistance(
      game.pos.x,
      game.pos.y,
      stage.target[0],
      stage.target[1],
    );
    const onMark = overStation(
      reachNow,
      stageStation(stage.kind, stage.sits),
    );
    const showHint =
      showGuides &&
      (stage.kind === "crank" ||
        (stage.kind === "place" && !held) ||
        ((stage.kind === "hold" ||
          stage.kind === "tilt" ||
          stage.kind === "tamp") &&
          held &&
          !onMark &&
          !game.tamping));
    for (let i = 0; i < HINT_DOTS; i++) {
      const dot = hintRefs.current[i];
      if (!dot) continue;
      dot.visible = showHint;
      if (!showHint) continue;
      if (stage.kind === "crank") {
        const angle = (i / HINT_DOTS) * Math.PI * 2 + time * 1.1;
        dot.position.set(
          stage.target[0] + Math.cos(angle) * CRANK_ARM,
          stage.target[1] + Math.sin(angle) * CRANK_ARM,
          CRANK_Z + 0.18,
        );
        dot.scale.setScalar(0.07);
      } else {
        const t = (i / HINT_DOTS + time * 0.35) % 1;
        const fade = Math.sin(t * Math.PI);
        dot.position.set(
          game.pos.x + (stage.target[0] - game.pos.x) * t,
          game.pos.y + (stage.target[1] - game.pos.y) * t,
          REST_Z + 0.04 + fade * 0.3,
        );
        dot.scale.setScalar(0.06 + fade * 0.08);
      }
    }

    // Liquid standing in the vessel, with its crema riding on the surface.
    const level = pours ? clamp01(game.destinationVolume) : 0;
    const surface = vessel.floor + level * vessel.depth;
    const fill = fillRef.current;
    if (fill) {
      fill.visible = level > 0.01;
      fill.scale.y = Math.max(level, 1e-3);
      fill.position.z = vessel.floor + (level * vessel.depth) / 2;
    }
    // The surface rides on top of whatever is in the vessel, and is where all
    // the movement happens.
    const top = surfaceRef.current;
    if (top) {
      top.visible = level > 0.02;
      top.position.z = surface + 0.01;
    }
    const sourceLevel =
      stage.kind === "tilt"
        ? clamp01(game.sourceVolume / 1.2)
        : stage.kind === "shake"
          ? 0.72
          : 0;
    if (sourceFillRef.current && sourceVessel) {
      sourceFillRef.current.visible = sourceLevel > 0.01;
      sourceFillRef.current.scale.y = Math.max(sourceLevel, 1e-3);
      sourceFillRef.current.position.z =
        sourceVessel.floor + (sourceLevel * sourceVessel.depth) / 2;
    }
    if (sourceSurfaceRef.current && sourceVessel) {
      sourceSurfaceRef.current.visible = sourceLevel > 0.02;
      sourceSurfaceRef.current.position.z =
        sourceVessel.floor +
        sourceLevel * sourceVessel.depth +
        0.012 +
        (stage.kind === "shake"
          ? Math.sin(time * 15) * 0.025 * working
          : 0);
      // Counter the vessel roll so the free surface stays level while the
      // container tips around it.
      sourceSurfaceRef.current.rotation.x = -(itemRef.current?.rotation.x ?? 0);
      sourceSurfaceRef.current.rotation.y = -(itemRef.current?.rotation.y ?? 0);
      sourceSurfaceRef.current.rotation.z = -(itemRef.current?.rotation.z ?? 0);
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
        band.position.z = vessel.floor + edge * vessel.depth;
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
    game.churn = approach(
      game.churn,
      tampDust > 0.04 ? tampDust : working > 0.12 ? working : 0,
      10,
      dt,
    );
    churnRef.current = game.churn;

    const carrySpeed = Math.hypot(
      game.pos.x - lastCarryRef.current.x,
      game.pos.y - lastCarryRef.current.y,
    );
    lastCarryRef.current.set(game.pos.x, game.pos.y, game.pos.z);
    jostleRef.current = approach(
      jostleRef.current,
      held && carrySpeed > 0.04
        ? Math.min(0.7, (carrySpeed - 0.04) * 6)
        : 0,
      14,
      dt,
    );
    artRef.current = Math.min(1, game.flourish / 10);

    // The stream runs from the lip of whatever is being tipped, or from the
    // group head during an extraction — espresso falls on its own once locked.
    const streaming =
      stage.kind === "tilt"
        ? working
        : stage.kind === "hold" && onMark
          ? Math.max(working, 0.45)
          : 0;
    if (streaming > 0.08 && !game.wasPouring) playSfx("pour");
    game.wasPouring = streaming > 0.02;

    const heard = heardRef.current;
    const lockedGroup =
      stage.kind === "hold" &&
      usesGroup(stage) &&
      Boolean(game.holder) &&
      overStation(
        flatDistance(game.pos.x, game.pos.y, stage.target[0], stage.target[1]),
        stageStation(stage.kind, stage.sits),
      );
    if (lockedGroup && !heard.lock) {
      heard.lock = true;
      playSfx("lock");
    }
    if (stage.flourish === "heart" && game.flourish > heard.heart) {
      if (game.flourish === 3 || game.flourish === 7) playSfx("heart");
      heard.heart = game.flourish;
    }
    if (stage.kind === "shake" && working > 0.2) playSfx("foam");
    if (steamRef.current > 0.22 && !heard.steam) {
      heard.steam = true;
      playSfx("steam");
    }
    const hurryNow = game.elapsed > limit - HURRY_AT && game.touched;
    if (hurryNow && !heard.hurry) {
      heard.hurry = true;
      playSfx("hurry");
    }
    let nextWork: WorkLoop = null;
    if (working > 0.12) {
      if (stage.kind === "crank") nextWork = "grind";
      else if (stage.kind === "hold" && usesGroup(stage)) nextWork = "extract";
      else if (stage.kind === "hold" || stage.kind === "tilt") nextWork = "pour";
      else if (stage.kind === "shake") nextWork = "foam";
    } else if (heard.work && working > 0.04) {
      nextWork = heard.work;
    }
    if (nextWork !== heard.work) {
      heard.work = nextWork;
      setWorkLoop(nextWork);
    }
    flowRef.current =
      held && holderIsLive
        ? approach(flowRef.current, streaming, 14, dt)
        : 0;
    const pourTilt = stage.kind === "tilt" ? Math.min(Math.abs(game.tilt), 1.25) : 0;
    if (stage.kind === "hold" && usesGroup(stage)) {
      const [left, right] = GROUP.spouts;
      spoutRef.current.set(
        stage.target[0] + left[0],
        stage.target[1] + left[1],
        left[2],
      );
      spoutBRef.current.set(
        stage.target[0] + right[0],
        stage.target[1] + right[1],
        right[2],
      );
    } else if (stage.kind === "hold") {
      spoutRef.current.set(stage.target[0], stage.target[1] - 0.42, 1.22);
      spoutBRef.current.set(stage.target[0], stage.target[1] - 0.42, -99);
    } else {
      // The lip, not the middle. Its offset comes from the held vessel and is
      // rotated by both its authored yaw and the player's tilt, keeping the
      // stream connected to the visible spout instead of sliding off the model.
      const heldEntry = KIT[stage.holds];
      const heldVessel = heldEntry?.vessel;
      const yaw = heldEntry?.yaw ?? 0;
      const lipReach = (heldVessel?.radius ?? 0.42) + 0.18;
      const lipX = Math.cos(yaw) * lipReach;
      const lipY = Math.sin(yaw) * lipReach - 0.05;
      const lipZ = heldVessel
        ? heldVessel.floor + heldVessel.depth * 0.86
        : 0.52;
      spoutRef.current.set(
        game.pos.x + Math.cos(pourTilt) * lipX + Math.sin(pourTilt) * lipZ,
        game.pos.y + lipY,
        game.lift.value - Math.sin(pourTilt) * lipX + Math.cos(pourTilt) * lipZ,
      );
      spoutBRef.current.set(
        game.pos.x,
        game.pos.y,
        -99,
      );
    }
    const bed = usesDripper(stage) && stage.kind === "tilt" ? DRIPPER.bed : surface;
    const cup = brewAt(stage);
    basinRef.current.set(cup[0], cup[1], bed);
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
        near: held ? onMark : game.near,
        marks: game.published,
        hurry: game.elapsed > limit - HURRY_AT,
        working: working > 0.05,
        done: false,
      });
    }

    writeGloveHold(holdRef?.current, {
      handedness: game.holder ?? nearHand,
      tool: stage.holds,
      near,
      holding: held || game.dumping || game.tamping,
      gripX: game.pos.x,
      gripY: game.pos.y,
      gripZ:
        game.lift.value +
        (game.tamping
          ? tampPose(
              tampAmount(game.tampElapsed),
              game.tampHit ? Math.max(0, game.amount - 1) : game.amount,
            ).lift
          : 0) +
        0.1,
      dump: game.dumping ? dumpAmount(game.dumpElapsed) : 0,
    });
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
          position={cupAt}
        />
      )}
      {shown.kind !== "crank" && (
        <Prop key={`mat-${key}`} kind="mat" position={shown.item} />
      )}

      <group position={[cupAt[0], cupAt[1], 0]}>
        <Level
          fillRef={fillRef}
          surfaceRef={surfaceRef}
          bandRefs={bandRefs}
          slosh={sloshRef}
          radius={vessel.radius}
          height={vessel.depth}
          look={liquid}
        />
        <Steam amount={steamRef} position={[0, 0, vessel.floor + 0.34]} />
        {/* What went over the rim, left on the counter where it landed. */}
        <Spill
          amount={spillRef}
          position={[0, -0.2, REST_Z - 0.09]}
          colour={liquid.colour}
        />
        {(shown.kind === "crank" || shown.sits === "grinder") && (
          <>
            <Beans
              position={[0, 0, 0.5]}
              radius={0.74}
              count={34}
              shake={shown.kind === "crank" ? churnRef : undefined}
              colour="#3b1f10"
              heap
            />
            <GroundDust amount={churnRef} position={[0, 0, 0.58]} />
          </>
        )}
        {shown.kind === "tilt" && usesDripper(shown) && (
          <Beans
            position={DRIPPER.heap}
            radius={DRIPPER.radius}
            count={DRIPPER.count}
            colour={GROUNDS}
            heap
            grain={0.045}
          />
        )}
        {shown.kind === "tamp" && (
          <>
            <Beans
              position={[0, -0.28, 0.28]}
              radius={0.4}
              count={26}
              shake={churnRef}
              colour={GROUNDS}
              heap
            />
            <GroundDust
              amount={churnRef}
              position={[0, -0.12, 0.4]}
              count={18}
            />
          </>
        )}
        {shown.flourish === "heart" && (
          <LatteArt
            amount={artRef}
            position={[0, 0, vessel.floor + vessel.depth * 0.62]}
            radius={vessel.radius * 0.4}
          />
        )}
      </group>

      {/* The one object the player can hold this stage */}
      <group ref={itemRef}>
        <Prop
          key={`holds-${key}`}
          kind={shown.holds}
          showCargo={cargoOn && Boolean(KIT[shown.holds]?.cargo)}
          shake={jostleRef}
        />
        {(shown.kind === "tilt" || shown.kind === "shake") && sourceVessel && (
          <>
            <mesh ref={sourceFillRef} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry
                args={[
                  sourceVessel.radius * 0.92,
                  sourceVessel.radius * 0.88,
                  sourceVessel.depth,
                  32,
                ]}
              />
              <meshStandardMaterial
                color={liquid.colour}
                roughness={liquid.roughness}
                metalness={liquid.metalness}
                transparent={liquid.opacity < 1}
                opacity={liquid.opacity}
              />
            </mesh>
            <mesh ref={sourceSurfaceRef}>
              <circleGeometry args={[sourceVessel.radius * 0.9, 32]} />
              <meshStandardMaterial
                color={liquid.skin ?? liquid.colour}
                roughness={liquid.skin ? 0.68 : liquid.roughness}
                metalness={liquid.metalness}
                transparent={liquid.opacity < 1}
                opacity={liquid.opacity}
              />
            </mesh>
            {shown.kind === "shake" && (
              <Beans
                position={[
                  0,
                  0,
                  sourceVessel.floor + sourceVessel.depth * 0.74,
                ]}
                radius={sourceVessel.radius * 0.72}
                count={14}
                shake={churnRef}
                colour={LIQUIDS.foam.colour}
              />
            )}
          </>
        )}
      </group>

      <BeanSpill
        firedAt={spillAtRef}
        from={spillFromRef}
        to={spillToRef}
        count={spillLook.count}
        colour={spillLook.colour}
      />

      {/* The pour itself, falling from the lip to the surface below it. */}
      <PourStream
        flow={flowRef}
        from={spoutRef}
        to={basinRef}
        colour={liquid.colour}
        thickness={liquid.thickness}
      />
      <PourStream
        flow={flowRef}
        from={spoutBRef}
        to={basinRef}
        colour={liquid.colour}
        thickness={liquid.thickness * 0.92}
      />
      <PourImpact flow={flowRef} to={basinRef} colour={liquid.colour} />

      <Burst firedAt={cheeredAtRef} origin={cheerOriginRef} />
    </group>
  );
}
