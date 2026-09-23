"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Group, Mesh, Object3D, SkinnedMesh } from "three";
import {
  Color,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  landmarkToWorld,
  type Handedness,
  type TrackedHand,
} from "@/hooks/useHandTracking";
import {
  LOCKED_SPAN,
  layoutSign,
  layoutSkew,
  layoutSpread,
  lockSpan,
  makeFrame,
  palmFrame,
} from "@/hooks/palmFrame";
import { boneAim, makeAimScratch } from "@/hooks/boneAim";

// Rigged hand meshes from @webxr-input-profiles/assets (MIT), the same models
// three.js uses for WebXR hand tracking. Both are loaded because which one a
// hand needs is measured from the landmarks, not assumed: the camera is
// mirrored, and a mirror turns a right hand into a left one.
const MODEL_URLS = ["/models/hand-left.glb", "/models/hand-right.glb"] as const;

MODEL_URLS.forEach((url) => useGLTF.preload(url));

// Each bone is aimed along the direction of the MediaPipe landmark pair that
// spans the same anatomical bone. Bone lengths always stay the model's own, so
// the hand can never stretch no matter how noisy tracking gets.
//
// Joints are also held to what a real hand can do. Without this, landmark noise
// bends fingers sideways and backwards and the result looks like a horror prop:
// `splay` caps sideways deviation from the parent bone, `curl` caps the bend
// toward the palm, and `hyper` caps the bend the other way (all radians).
type Limits = {
  /** Sideways deviation allowed off the parent bone, in radians. */
  splay: number;
  curl: number;
  hyper: number;
  /**
   * When set, the joint is a ball joint free to move anywhere inside this cone
   * around its parent, instead of a hinge. The thumb needs it: closing a hand
   * swings the thumb across the palm, which is opposition, not bending, and a
   * hinge plane simply cannot express it — the thumb stays sticking out while
   * the fingers close.
   */
  cone?: number;
};

const HINGE: Limits = { splay: 0.06, curl: 1.95, hyper: 0.1 };
const KNUCKLE: Limits = { splay: 0.38, curl: 1.65, hyper: 0.22 };
const TIP_JOINT: Limits = { splay: 0.06, curl: 1.5, hyper: 0.1 };
const THUMB_BASE: Limits = { splay: 0.7, curl: 1.0, hyper: 0.55, cone: 1.25 };
const THUMB_MID: Limits = { splay: 0.35, curl: 1.2, hyper: 0.25, cone: 1.45 };
const THUMB_END: Limits = { splay: 0.12, curl: 1.4, hyper: 0.2, cone: 1.5 };

type ChainLink = {
  bone: string;
  aim: readonly [number, number] | null;
  limits: Limits | null; // null keeps the bone rigid at its bind pose
};

const WRIST_BONE = "wrist";
const WRIST_AIM = [0, 9] as const;

const CHAINS: readonly (readonly ChainLink[])[] = [
  [
    { bone: "thumb-metacarpal", aim: [1, 2], limits: THUMB_BASE },
    { bone: "thumb-phalanx-proximal", aim: [2, 3], limits: THUMB_MID },
    { bone: "thumb-phalanx-distal", aim: [3, 4], limits: THUMB_END },
    { bone: "thumb-tip", aim: null, limits: null },
  ],
  [
    { bone: "index-finger-metacarpal", aim: null, limits: null },
    { bone: "index-finger-phalanx-proximal", aim: [5, 6], limits: KNUCKLE },
    { bone: "index-finger-phalanx-intermediate", aim: [6, 7], limits: HINGE },
    { bone: "index-finger-phalanx-distal", aim: [7, 8], limits: TIP_JOINT },
    { bone: "index-finger-tip", aim: null, limits: null },
  ],
  [
    { bone: "middle-finger-metacarpal", aim: null, limits: null },
    { bone: "middle-finger-phalanx-proximal", aim: [9, 10], limits: KNUCKLE },
    { bone: "middle-finger-phalanx-intermediate", aim: [10, 11], limits: HINGE },
    { bone: "middle-finger-phalanx-distal", aim: [11, 12], limits: TIP_JOINT },
    { bone: "middle-finger-tip", aim: null, limits: null },
  ],
  [
    { bone: "ring-finger-metacarpal", aim: null, limits: null },
    { bone: "ring-finger-phalanx-proximal", aim: [13, 14], limits: KNUCKLE },
    { bone: "ring-finger-phalanx-intermediate", aim: [14, 15], limits: HINGE },
    { bone: "ring-finger-phalanx-distal", aim: [15, 16], limits: TIP_JOINT },
    { bone: "ring-finger-tip", aim: null, limits: null },
  ],
  [
    { bone: "pinky-finger-metacarpal", aim: null, limits: null },
    { bone: "pinky-finger-phalanx-proximal", aim: [17, 18], limits: KNUCKLE },
    { bone: "pinky-finger-phalanx-intermediate", aim: [18, 19], limits: HINGE },
    { bone: "pinky-finger-phalanx-distal", aim: [19, 20], limits: TIP_JOINT },
    { bone: "pinky-finger-tip", aim: null, limits: null },
  ],
];

// The bone each chain link points at in the bind pose, used to read the bone's
// rest direction. Tips have no successor.
const CHAIN_CHILD: Record<string, string> = {
  [WRIST_BONE]: "middle-finger-phalanx-proximal",
};
for (const chain of CHAINS) {
  for (let i = 0; i < chain.length - 1; i++) {
    CHAIN_CHILD[chain[i].bone] = chain[i + 1].bone;
  }
}

// Hand size is locked while a hand is recognized. MediaPipe's image-space
// span grows and shrinks with camera distance; following that made the glove
// (and its grab reach) pulse. A fixed palm span keeps both steady.

// Relaxed open hand in palm spans, wrist at the origin, palm toward the camera.
// Stands in for landmarks before any hand has been seen, and under the pointer
// in mouse-fallback mode.
const REST_POSE: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [-0.42, 0.22, 0.1],
  [-0.72, 0.5, 0.18],
  [-0.9, 0.72, 0.24],
  [-1.0, 0.92, 0.28],
  [-0.38, 0.92, 0],
  [-0.43, 1.4, 0.06],
  [-0.45, 1.7, 0.16],
  [-0.46, 1.92, 0.26],
  [0, 1.0, 0],
  [0.01, 1.51, 0.05],
  [0.02, 1.84, 0.15],
  [0.02, 2.08, 0.26],
  [0.34, 0.95, 0],
  [0.41, 1.42, 0.06],
  [0.45, 1.72, 0.17],
  [0.47, 1.94, 0.28],
  [0.66, 0.84, 0],
  [0.76, 1.19, 0.06],
  [0.81, 1.42, 0.15],
  [0.84, 1.6, 0.24],
];

// The chirality the resting pose above happens to be written with. The world
// mapping scales each axis independently but never flips one, so this sign
// carries straight through to world space and can be compared with a model's.
const REST_CHIRALITY =
  Math.sign(
    handednessVolume(
      new Vector3(...REST_POSE[0]),
      new Vector3(...REST_POSE[5]),
      new Vector3(...REST_POSE[17]),
      new Vector3(...REST_POSE[9]),
      new Vector3(...REST_POSE[1]),
    ),
  ) || 1;

// Barista gloves: porcelain cloth with a cuff per hand — a light latte band and
// a dark cinnamon one, far enough apart in tone to tell at a glance.
const HAND_ACCENTS: Record<Handedness, string> = {
  Left: "#d98c3c",
  Right: "#7a3b1e",
};
const GLOVE_TRACKED = new Color("#f2e8d5");
// Still cloth, just in shade — any browner and the glove reads as bare skin.
const GLOVE_RESTING = new Color("#c9b9a4");
const GRAB_COLOR = new Color("#f0b429");

const AXIS_Z = new Vector3(0, 0, 1);

const DEFAULT_SPAN = LOCKED_SPAN;
const SPEED_FULL = 3.2;
const REST_RATE = 2.6;
const SHOWN_FLOOR = 0.02;

/**
 * The handful of numbers that decide how the hand feels, gathered in one place
 * and read at runtime so they can be dialled in against a live camera instead
 * of guessed at and rebuilt. The defaults are the tuned values.
 */
export const handTuning = {
  /**
   * Smoothing in e-folds per second: heavy at rest, light once moving, so
   * jitter dies without the hand feeling laggy.
   *
   * These used to be 7 and 34, which was the single biggest source of lag in
   * the hand. The tracker already runs its own speed-adaptive filter at 14 to
   * 90 before these landmarks ever arrive, and two exponential filters in
   * series add their time constants: 14 then 7 is a settling time of about
   * 214ms at rest, where either alone would be half that. The second filter
   * was quietly undoing the first one's work.
   *
   * Matched to the tracker's own rates, this pass now only takes the edge off
   * what the world-space conversion adds, and the filter that was tuned
   * against real landmarks is the one deciding how the hand feels.
   */
  stillRate: 16,
  movingRate: 90,
  /**
   * Depth is still the noisiest axis tracking reports, so it is damped — but
   * not halved. The hand's rotation is read from depth now, and at 0.45 the
   * glove turned visibly later than the hand did.
   */
  depthDamping: 0.75,
  /**
   * How much of the reported depth to believe when orienting the palm.
   *
   * The palm frame used to be built from vectors flattened to z = 0, which
   * bought stability by throwing away two of the three rotations: a hand could
   * roll in the image plane and nothing else. Pitch and yaw are in the depth
   * differences between landmarks, and they are real — just noisy. Believing a
   * fraction of them is the same bargain `WORLD_Z` makes in the tracker: less
   * than the truth, but far more than nothing.
   *
   * At 1 the glove matches the hand and shivers with it. At 0 it is back to
   * the flat behaviour this replaced.
   */
  tilt: 0.7,
  /** The same dead zone for finger bones. Generous on purpose: the player's
   *  proportions never match the model's, and reading that as foreshortening
   *  would leave every finger permanently half curled. */
  fingerReach: 0.82,
  /**
   * How quickly the hand turns to face where tracking says it faces.
   *
   * Deliberately slower than the rate positions follow, because the two are
   * not comparable: an error of a degree in the palm swings every fingertip
   * across the screen, while an error of a millimetre in a fingertip moves a
   * fingertip. Orientation was following at the position rate, and raising
   * that rate to fix the lag took the damping off the turn along with it —
   * which is most of why the hand started snapping about.
   */
  turnRate: 11,
  /** Arriving is quick, leaving gentler, so a dropped frame is not a flicker. */
  showRate: 14,
  hideRate: 5,
};

/**
 * How the hand is presented, as opposed to how it moves. Both of these are
 * answers that depend on how a player actually holds their hand in front of a
 * camera, so they are switches to be settled by looking, not constants to be
 * reasoned about.
 */
export const handView = {
  /** Turn the hand over so the back faces the player. Reaching onto a table you
   *  see the backs of your hands, so this is what reads as your own hand. */
  faceDorsal: true,
  /** Use the other model of the mirrored pair. */
  swapHands: false,
};
// How far out of the palm plane the thumb must sit before the reading counts,
// and how many agreeing frames settle it. Depth arrives heavily compressed, so
// the bar is low — but the sign is what matters, and it holds steady.
// How square the palm axes must be before the layout sign is trusted, and how
// many frames must agree before swapping models. Near edge-on the two axes
// close up and the sign means nothing.
const LAYOUT_CONFIDENCE = 0.85;
/**
 * The least span across the knuckles, as a share of the hand's length, that
 * counts as enough hand to read a layout from. An open hand sits near 0.5.
 */
const LAYOUT_SPREAD = 0.3;
const LAYOUT_FRAMES = 6;
/** Radians per second a single bone may turn. Real fingers close well inside
 *  this; a solve that jumps does not. */
const MAX_BONE_SLEW = 16;
const SWAP_COOLDOWN = 0.6;
const PAINT_RATE = 9;

type BoneRig = {
  node: Object3D;
  restPos: Vector3;
  restQuat: Quaternion;
  restDir: Vector3 | null;
  restLength: number;
  aim: readonly [number, number] | null;
  limits: Limits | null;
  hinge: Vector3; // bend axis at rest
  curlSign: number; // which way around `hinge` folds toward the palm
  /** Where this bone last pointed, to hold through unreadable frames and to
   *  measure how far it is being asked to jump in one step. */
  lastDir: Vector3;
  settled: boolean;
};

type Rig = {
  armature: Object3D;
  wrist: BoneRig;
  chains: BoneRig[][];
  modelSpan: number;
  modelBasisInv: Quaternion;
  palmDir: Vector3;
};

// Per-frame state, owned by a ref and mutated only inside the render loop.
function createGloveState(handedness: Handedness) {
  return {
    current: Array.from({ length: 21 }, () => new Vector3()),
    target: Array.from({ length: 21 }, () => new Vector3()),
    accent: new Color(HAND_ACCENTS[handedness]),
    cuffTint: new Color(HAND_ACCENTS[handedness]),
    material: new MeshStandardMaterial({
      color: GLOVE_TRACKED,
      emissive: GRAB_COLOR,
      emissiveIntensity: 0,
      roughness: 0.62,
      metalness: 0,
    }),
    rig: null as Rig | null,
    rigFor: null as Object3D | null,
    layoutAgreed: 0,
    swapCooldown: 0,
    freshStart: true,
    v: new Vector3(),
    offset: new Vector3(),
    prevPos: new Vector3(),
    prevRest: new Vector3(),
    prevDir: new Vector3(),
    aimed: new Vector3(),
    hinge: new Vector3(),
    viewAxis: new Vector3(),
    perp: new Vector3(),
    flatParent: new Vector3(),
    flatTarget: new Vector3(),
    axis: new Vector3(),
    twist: new Quaternion(),
    // Two frames: the one the glove is worn in, and a flat one used only to
    // choose which of the mirrored pair to wear. See hooks/palmFrame.ts.
    frame: makeFrame(),
    flat: makeFrame(),
    aimScratch: makeAimScratch(),
    dir: new Vector3(),
    quat: new Quaternion(),
    swing: new Quaternion(),
    delta: new Quaternion(),
    prevDelta: new Quaternion(),
    basis: new Matrix4(),
    inverse: new Matrix4(),
    prevWrist: new Vector3(),
    palmWorld: new Vector3(),
    smoothed: new Quaternion(),
    span: DEFAULT_SPAN,
    presence: 0,
    grab: 0,
    seeded: false,
    turned: false,
    shown: 0,
  };
}

type GloveState = ReturnType<typeof createGloveState>;

type BindPose = Map<string, { pos: Vector3; quat: Quaternion }>;

function findSkinnedMesh(root: Object3D): SkinnedMesh | null {
  let found: SkinnedMesh | null = null;
  root.traverse((child) => {
    if (!found && (child as SkinnedMesh).isSkinnedMesh) {
      found = child as SkinnedMesh;
    }
  });
  return found;
}

// Bind data comes from the skeleton's inverse bind matrices rather than the
// live bone transforms, so it stays correct even though the scene gets posed
// every frame.
function readBindPose(mesh: SkinnedMesh): BindPose {
  const bind: BindPose = new Map();
  mesh.skeleton.bones.forEach((bone, index) => {
    const matrix = mesh.skeleton.boneInverses[index].clone().invert();
    const pos = new Vector3();
    const quat = new Quaternion();
    matrix.decompose(pos, quat, new Vector3());
    bind.set(bone.name, { pos, quat });
  });
  return bind;
}

/**
 * Signed volume telling a right hand from a left one. Across the knuckles,
 * along the palm and out to the thumb form three axes whose handedness is the
 * hand's own, and the sign of their triple product is the whole of the test.
 * Measuring this beats assuming it: mirroring the camera flips it, and a
 * measured answer cannot fall out of step with a change made somewhere else.
 * The magnitude matters too — near zero the hand is edge-on or the thumb is
 * folded flat, and the reading should not be trusted.
 */
function handednessVolume(
  wrist: Vector3,
  indexKnuckle: Vector3,
  pinkyKnuckle: Vector3,
  middleKnuckle: Vector3,
  thumb: Vector3,
  across = new Vector3(),
  along = new Vector3(),
  out = new Vector3(),
): number {
  across.copy(pinkyKnuckle).sub(indexKnuckle);
  along.copy(middleKnuckle).sub(wrist);
  out.copy(thumb).sub(wrist);
  const scale = across.length() * along.length() * out.length();
  if (scale < 1e-9) return 0;
  // Normalised, so it reads as "how far out of the palm plane the thumb sits"
  // rather than a volume that shrinks with the hand and with the squashed
  // depth axis. Only the sign is used, but the size says how much to trust it.
  return across.cross(along).dot(out) / scale;
}

const BIND_LANDMARKS = [
  WRIST_BONE,
  "index-finger-phalanx-proximal",
  "pinky-finger-phalanx-proximal",
  "middle-finger-phalanx-proximal",
  "thumb-metacarpal",
] as const;

/** The chirality a model was authored with, read from its own bind pose. */
function modelChirality(root: Object3D): number {
  const mesh = findSkinnedMesh(root);
  if (!mesh) return 1;
  const bind = readBindPose(mesh);
  const points = BIND_LANDMARKS.map((name) => bind.get(name)?.pos);
  if (points.some((point) => !point)) return 1;
  const [wrist, index, pinky, middle, thumb] = points as Vector3[];
  return Math.sign(handednessVolume(wrist, index, pinky, middle, thumb)) || 1;
}

function buildRig(root: Object3D, material: MeshStandardMaterial): Rig | null {
  const skinned = findSkinnedMesh(root);
  if (!skinned) return null;

  const mesh = skinned as SkinnedMesh;
  mesh.material = material;
  // Bones travel far from the bind pose, which otherwise culls the hand away.
  mesh.frustumCulled = false;
  // The shadow on the table is what tells the player how close their hand is.
  mesh.castShadow = true;

  const bind = readBindPose(mesh);

  const middle = bind.get("middle-finger-phalanx-proximal");
  const index = bind.get("index-finger-phalanx-proximal");
  const pinky = bind.get("pinky-finger-phalanx-proximal");
  const wristBind = bind.get(WRIST_BONE);
  const thumbBind = bind.get("thumb-metacarpal");
  if (!middle || !index || !pinky || !wristBind || !thumbBind) return null;

  const up = middle.pos.clone().sub(wristBind.pos);
  const modelSpan = up.length();
  up.divideScalar(modelSpan);
  const across = pinky.pos.clone().sub(index.pos);
  const normal = across.clone().cross(up).normalize();
  const side = up.clone().cross(normal).normalize();

  // `normal` points out of the palm on one model and out of the back on the
  // other (the two glTFs are mirror images), so read which way the palm faces
  // off the thumb, which always sits on the palm side of the hand plane.
  const palmDir = normal
    .clone()
    .multiplyScalar(
      Math.sign(thumbBind.pos.clone().sub(wristBind.pos).dot(normal)) || 1,
    );

  const link = (item: ChainLink) => {
    const node = mesh.skeleton.bones.find((bone) => bone.name === item.bone);
    const rest = bind.get(item.bone);
    if (!node || !rest) return null;
    const childName = CHAIN_CHILD[item.bone];
    const childRest = childName ? bind.get(childName) : undefined;
    const bone = childRest ? childRest.pos.clone().sub(rest.pos) : null;
    const restLength = bone ? bone.length() : 0;
    const restDir = bone ? bone.clone().normalize() : null;

    let hinge = side.clone();
    let curlSign = 1;
    if (restDir) {
      const axis = restDir.clone().cross(palmDir);
      if (axis.lengthSq() > 1e-8) hinge = axis.normalize();
      curlSign =
        Math.sign(hinge.clone().cross(restDir).dot(palmDir)) || 1;
    }

    return {
      node,
      restPos: rest.pos,
      restQuat: rest.quat,
      restDir,
      restLength,
      aim: item.aim,
      limits: item.limits,
      hinge,
      curlSign,
      lastDir: (restDir ?? new Vector3(0, 1, 0)).clone(),
      settled: false,
    };
  };

  const wrist = link({ bone: WRIST_BONE, aim: WRIST_AIM, limits: null });
  if (!wrist || !wrist.restDir) return null;

  const chains: BoneRig[][] = [];
  for (const chain of CHAINS) {
    const links: BoneRig[] = [];
    for (const item of chain) {
      const built = link(item);
      if (built) links.push(built);
    }
    chains.push(links);
  }

  return {
    armature: root,
    wrist,
    chains,
    modelSpan,
    modelBasisInv: new Quaternion()
      .setFromRotationMatrix(new Matrix4().makeBasis(side, up, normal))
      .invert(),
    palmDir,
  };
}

// MediaPipe reports depth on a much smaller scale than it reports x and y, so a
// Where one bone points. The reasoning, and the tests, live in
// hooks/boneAim.ts — including why the sign of the tracked depth is believed
// where the magnitude is not, which is what lets a hand be held at an angle.
function trackedDirection(
  glove: GloveState,
  points: Vector3[],
  aim: readonly [number, number],
  restLength: number,
  depthSign: number,
): Vector3 {
  return boneAim(
    points[aim[0]],
    points[aim[1]],
    glove.viewAxis,
    restLength,
    handTuning.fingerReach,
    depthSign,
    glove.aimScratch,
    glove.dir,
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Fold `raw` into the cone of motion the joint actually has: at most `splay`
// sideways off the parent bone, and a bend around `hinge` between `hyper`
// backwards and `curl` toward the palm.
function constrainDirection(
  glove: GloveState,
  raw: Vector3,
  parentDir: Vector3,
  hinge: Vector3,
  curlSign: number,
  limits: Limits,
  /** Where this bone pointed last frame, for cases with no angle to read. */
  hold: Vector3,
  out: Vector3,
): Vector3 {
  // A ball joint: anywhere inside a cone around the parent bone.
  if (limits.cone !== undefined) {
    const apart = Math.acos(clamp(raw.dot(parentDir), -1, 1));
    if (apart <= limits.cone) return out.copy(raw);
    glove.axis.crossVectors(parentDir, raw);
    if (glove.axis.lengthSq() < 1e-8) return out.copy(parentDir);
    glove.axis.normalize();
    glove.twist.setFromAxisAngle(glove.axis, limits.cone);
    return out.copy(parentDir).applyQuaternion(glove.twist);
  }

  const splay = clamp(
    Math.asin(clamp(raw.dot(hinge), -1, 1)),
    -limits.splay,
    limits.splay,
  );

  // Both directions flattened into the joint's bend plane. When one of them
  // lies along the hinge there is no angle to read, and the bone must simply
  // hold the bend it already had: falling back to the parent direction here
  // snapped the finger straight for a frame, which is what the flicker during
  // fast movement was.
  glove.flatParent
    .copy(parentDir)
    .addScaledVector(hinge, -parentDir.dot(hinge));
  if (glove.flatParent.lengthSq() < 1e-8) return out.copy(hold);
  glove.flatParent.normalize();

  glove.flatTarget.copy(raw).addScaledVector(hinge, -raw.dot(hinge));
  if (glove.flatTarget.lengthSq() < 1e-8) return out.copy(hold);
  glove.flatTarget.normalize();

  const bend = Math.atan2(
    glove.axis.crossVectors(glove.flatParent, glove.flatTarget).dot(hinge),
    glove.flatParent.dot(glove.flatTarget),
  );
  const curl = clamp(bend * curlSign, -limits.hyper, limits.curl);

  glove.twist.setFromAxisAngle(hinge, curl * curlSign);
  out.copy(glove.flatParent).applyQuaternion(glove.twist);
  return out
    .multiplyScalar(Math.cos(splay))
    .addScaledVector(hinge, Math.sin(splay))
    .normalize();
}

export function GloveHand({
  handedness,
  handsRef,
}: {
  handedness: Handedness;
  handsRef: RefObject<TrackedHand[]>;
}) {
  const modelRef = useRef<Group>(null);
  const cuffRef = useRef<Mesh>(null);
  const stateRef = useRef<GloveState | null>(null);
  // useGLTF hands back one cached scene per URL. Posing it directly would mean
  // mutating shared state, and re-attaching it after a remount throws inside
  // the render loop, so each glove drives its own skeleton-aware copy.
  const leftScene = useGLTF(MODEL_URLS[0]).scene;
  const rightScene = useGLTF(MODEL_URLS[1]).scene;
  const models = useMemo(
    () =>
      [leftScene, rightScene].map((scene) => {
        const clone = cloneSkeleton(scene);
        return { clone, chirality: modelChirality(clone) };
      }),
    [leftScene, rightScene],
  );

  // Start with the labelled side's asset; chirality lock below may swap once the
  // mirrored landmark topology is clear (a mirror turns a right hand left).
  const [picked, setPicked] = useState(handedness === "Right" ? 1 : 0);
  const chosen = handView.swapHands ? 1 - picked : picked;
  const handModel = models[chosen].clone;

  // The resting pose is a fixed set of numbers with a chirality of its own, so
  // it gets flipped to match whichever model ended up chosen.
  const poseMirror = models[chosen].chirality === REST_CHIRALITY ? 1 : -1;
  // Which side of the table the hand waits on is a separate question, and the
  // one thing handedness still decides: the right hand belongs on the right.
  const restSide = handedness === "Right" ? 1 : -1;

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 0.05);
    const time = frame.clock.elapsedTime;
    const hand = (handsRef.current ?? []).find(
      (item) => item.handedness === handedness,
    );
    const tracked = hand?.smoothedLandmarks.length === 21;
    const glove = (stateRef.current ??= createGloveState(handedness));
    const { target, current } = glove;
    const paint = 1 - Math.exp(-PAINT_RATE * dt);

    if (tracked && hand) {
      for (let i = 0; i < 21; i++) {
        const world = landmarkToWorld(hand.smoothedLandmarks[i]);
        target[i].set(world.x, world.y, world.z);
      }
      // Lock visual size: rescale the landmark cloud around the wrist so bone
      // aiming matches the fixed glove scale. Without this, close hands feed
      // oversized targets into a small rig and the fingers contort. The debug
      // overlay runs the same call, which is the only way the two can be laid
      // over each other and compared.
      lockSpan(target, glove.v);
      glove.span = LOCKED_SPAN;
    } else if (hand) {
      // Pointer fallback: only a cursor, so the resting pose stands in for a
      // hand shape and is hung off the cursor.
      const breath = 1 + Math.sin(time * 1.25) * 0.018;
      glove.quat.setFromAxisAngle(AXIS_Z, Math.sin(time * 0.5) * 0.03 * restSide);
      for (let i = 0; i < 21; i++) {
        const [x, y, z] = REST_POSE[i];
        target[i]
          .set(x * poseMirror, y, z)
          .multiplyScalar(glove.span * breath)
          .applyQuaternion(glove.quat);
      }
      // Anchor the rest pose's pinch point onto the cursor so the glove lines
      // up with what the grab logic actually tests.
      glove.v.copy(target[4]).add(target[8]).multiplyScalar(0.5);
      glove.offset
        .set(hand.cursor.x, hand.cursor.y, hand.cursor.z)
        .sub(glove.v);
      for (let i = 0; i < 21; i++) target[i].add(glove.offset);
    }

    // A hand nobody can see does not belong on the table. It shrinks away and
    // stops being drawn, and comes back the moment tracking picks it up again.
    // Leaving is slower than arriving on purpose: tracking drops a frame here
    // and there, and a quick exit would read as flicker.
    glove.shown +=
      ((hand ? 1 : 0) - glove.shown) *
      (1 - Math.exp(-(hand ? handTuning.showRate : handTuning.hideRate) * dt));
    const onStage = glove.shown > SHOWN_FLOOR;
    if (!onStage) {
      // Next time it appears it should simply be there, not fly in from
      // wherever it was last seen, and its fingers should arrive posed rather
      // than creeping there under the slew limit.
      glove.seeded = false;
      glove.turned = false;
      glove.freshStart = true;
    }

    // Tracking jitters most when the hand is holding still, and that is exactly
    // when the eye notices. Smooth hard at rest and let go as the hand picks up
    // speed, so it stays responsive without shimmering.
    const speed = glove.seeded
      ? glove.prevWrist.distanceTo(target[0]) / dt
      : 999;
    glove.prevWrist.copy(target[0]);
    const eased = Math.min(1, speed / SPEED_FULL);
    const rate = tracked
      ? handTuning.stillRate +
        (handTuning.movingRate - handTuning.stillRate) * eased
      : hand
        ? handTuning.movingRate
        : REST_RATE;
    const posFollow = 1 - Math.exp(-rate * dt);
    // Depth is the noisiest axis MediaPipe reports, so it gets damped harder.
    const depthFollow = 1 - Math.exp(-rate * handTuning.depthDamping * dt);

    for (let i = 0; i < 21; i++) {
      if (glove.seeded) {
        current[i].x += (target[i].x - current[i].x) * posFollow;
        current[i].y += (target[i].y - current[i].y) * posFollow;
        current[i].z += (target[i].z - current[i].z) * depthFollow;
      } else {
        current[i].copy(target[i]);
      }
    }
    glove.seeded = true;
    glove.presence += ((hand ? 1 : 0) - glove.presence) * paint;
    glove.grab += ((hand?.isGrabbing ? 1 : 0) - glove.grab) * paint;

    glove.material.color.copy(GLOVE_RESTING).lerp(GLOVE_TRACKED, glove.presence);
    glove.material.emissiveIntensity = 0.24 * glove.grab;
    glove.cuffTint.copy(glove.accent).lerp(GRAB_COLOR, glove.grab);

    const model = modelRef.current;
    if (!model) return;
    // The rig holds direct references to this clone's bones. A remount hands
    // back a fresh clone, and a rig left pointing at the discarded one poses
    // bones nothing is skinned to any more: the hand keeps rendering, frozen in
    // its bind pose, and never animates again. So the rig is tied to the clone
    // it was read from and rebuilt whenever that changes.
    if (glove.rigFor !== handModel) {
      glove.rigFor = handModel;
      glove.rig = buildRig(model, glove.material);
    }
    const rig = glove.rig;
    if (!rig) return;

    // Two palm frames, because two jobs want different things from the same
    // landmarks: the glove is worn in one, and the choice of which mirrored
    // model to wear is read from the other. hooks/palmFrame.ts explains why
    // they cannot be the same frame, and carries the tests.
    //
    // Do NOT force a world-axis flip here — that mirrors side/up and turns a
    // right hand into a left one while the finger IK still aims at unmirrored
    // landmarks (contortion).
    palmFrame(
      current[0],
      current[9],
      current[5],
      current[17],
      handTuning.tilt,
      glove.frame,
    );
    // Tilt zero is the flat reading, which is the steady one.
    palmFrame(current[0], current[9], current[5], current[17], 0, glove.flat);
    glove.basis.makeBasis(
      glove.frame.side,
      glove.frame.up,
      glove.frame.normal,
    );

    // Choose which of the mirrored pair to wear, from the flat frame alone.
    // With depth dropped, the normal of that frame is simply +Z or -Z: the
    // sign says which way round the fingers run on screen, and that is all the
    // information there is about which hand this looks like. A left palm and a
    // right back draw the same silhouette, so the model and the face it shows
    // are one choice, not two.
    //
    // A model's own `chirality` is the side of its normal its palm lies on, so
    // aligning it puts the palm along `normal * chirality`. Wanting the palm
    // pointing away from the camera fixes the choice: chirality = -normal.z.
    //
    // This deliberately still uses no depth, even though the frame above now
    // does. Orienting the hand wrong for a frame is a wobble; picking the
    // wrong model rebuilds the rig, so this one stays on the steady reading.
    // For two vectors in the plane the cross product is only its z term, so
    // the sign is read straight off rather than building a third vector.
    const layout = layoutSign(glove.flat);
    const wanted = handView.faceDorsal ? -layout : layout;
    // Two separate ways this reading goes bad, and skew only catches one.
    // A hand with its fingers folded, or held edge-on, barely spans its own
    // knuckles: what is left is noise that normalises like anything else and
    // sits square to `up` often enough to pass a skew check while carrying a
    // sign that is a coin flip. Acting on it rebuilds the rig and mirrors the
    // model, which is the turn that came out of nowhere.
    const confident =
      layoutSkew(glove.flat) < LAYOUT_CONFIDENCE &&
      layoutSpread(glove.flat) > LAYOUT_SPREAD;
    glove.swapCooldown = Math.max(0, glove.swapCooldown - dt);
    if (
      tracked &&
      confident &&
      glove.swapCooldown === 0 &&
      models[chosen].chirality !== wanted
    ) {
      glove.layoutAgreed += 1;
      if (glove.layoutAgreed >= LAYOUT_FRAMES) {
        glove.layoutAgreed = 0;
        // Swapping rebuilds the rig, so hold off afterwards rather than let
        // one swap chase the next while the hand is turning.
        glove.swapCooldown = SWAP_COOLDOWN;
        const match = models.findIndex((entry) => entry.chirality === wanted);
        if (match >= 0) setPicked(handView.swapHands ? 1 - match : match);
      }
    } else {
      glove.layoutAgreed = 0;
    }

    // Place the whole model so its wrist lands on the tracked wrist, turned
    // into the tracked palm frame. Scale stays locked while the hand is present.
    model.visible = onStage;
    if (!onStage) {
      if (cuffRef.current) cuffRef.current.visible = false;
      return;
    }
    const scale = (LOCKED_SPAN / rig.modelSpan) * glove.shown;
    glove.quat.setFromRotationMatrix(glove.basis).multiply(rig.modelBasisInv);

    // Present the requested face. Note this negates two axes, not one: that is
    // a half turn about the hand's own up axis, so the fingers keep pointing
    // the same way on screen and the chirality is untouched. Negating a single
    // axis would mirror the hand instead, which is the contortion to avoid.
    glove.palmWorld.copy(rig.palmDir).applyQuaternion(glove.quat);
    if (glove.palmWorld.z > 0 === handView.faceDorsal) {
      glove.frame.normal.negate();
      glove.frame.side.negate();
      glove.basis.makeBasis(
        glove.frame.side,
        glove.frame.up,
        glove.frame.normal,
      );
      glove.quat.setFromRotationMatrix(glove.basis).multiply(rig.modelBasisInv);
    }
    const turnFollow = 1 - Math.exp(-handTuning.turnRate * dt);
    if (glove.turned) glove.smoothed.slerp(glove.quat, turnFollow);
    else glove.smoothed.copy(glove.quat);
    glove.turned = true;
    glove.quat.copy(glove.smoothed);
    model.quaternion.copy(glove.quat);
    model.scale.setScalar(scale);
    model.position
      .copy(current[0])
      .sub(
        glove.v.copy(rig.wrist.restPos).multiplyScalar(scale).applyQuaternion(glove.quat),
      );
    model.updateWorldMatrix(false, true);

    // Landmarks into the skeleton's own space, where the bone maths happens.
    glove.inverse.copy(rig.armature.matrixWorld).invert();
    for (let i = 0; i < 21; i++) {
      target[i].copy(current[i]).applyMatrix4(glove.inverse);
    }

    // Fingers fold toward the palm side of the rig.
    glove.viewAxis.set(0, 0, 1).transformDirection(glove.inverse);
    // Only a fallback now, for bones whose tracked depth is too small to read
    // a sign from. It used to decide every bone, which is why a hand held at
    // an angle collapsed with all its fingers pointing the same way.
    const depthSign = Math.sign(glove.viewAxis.dot(rig.palmDir)) || 1;

    // The wrist and the metacarpals stay at their bind pose, so the palm is one
    // rigid piece: its orientation comes from the palm frame above, which reads
    // four landmarks and is far steadier than aiming each bone on its own.
    const wrist = rig.wrist;
    wrist.node.position.copy(wrist.restPos);
    wrist.node.quaternion.copy(wrist.restQuat);

    for (const chain of rig.chains) {
      glove.prevPos.copy(wrist.restPos);
      glove.prevRest.copy(wrist.restPos);
      glove.prevDelta.identity();
      glove.prevDir.copy(wrist.restDir as Vector3);

      for (const bone of chain) {
        // Rigid bind-length offset, swung by however the parent bone turned.
        glove.offset
          .copy(bone.restPos)
          .sub(glove.prevRest)
          .applyQuaternion(glove.prevDelta);
        bone.node.position.copy(glove.prevPos).add(glove.offset);

        if (bone.aim && bone.restDir && bone.limits) {
          glove.hinge.copy(bone.hinge).applyQuaternion(glove.prevDelta);
          constrainDirection(
            glove,
            trackedDirection(
              glove,
              target,
              bone.aim,
              bone.restLength,
              depthSign,
            ),
            glove.prevDir,
            glove.hinge,
            bone.curlSign,
            bone.limits,
            bone.lastDir,
            glove.aimed,
          );

          // Cap how far a bone may swing in a single step. A finger closing
          // fast covers maybe half this; anything beyond it is not a hand
          // moving but the solve jumping, which is what shows up as a finger
          // snapping open for a frame during quick movement.
          if (bone.settled && !glove.freshStart) {
            const apart = Math.acos(
              clamp(glove.aimed.dot(bone.lastDir), -1, 1),
            );
            const allowed = MAX_BONE_SLEW * dt;
            if (apart > allowed) {
              glove.axis.crossVectors(bone.lastDir, glove.aimed);
              if (glove.axis.lengthSq() > 1e-10) {
                glove.axis.normalize();
                glove.twist.setFromAxisAngle(glove.axis, allowed);
                glove.aimed.copy(bone.lastDir).applyQuaternion(glove.twist);
              }
            }
          }
          bone.lastDir.copy(glove.aimed);
          bone.settled = true;
          glove.swing.setFromUnitVectors(bone.restDir, glove.aimed);
        } else {
          glove.swing.copy(glove.prevDelta);
        }
        bone.node.quaternion.copy(glove.swing).multiply(bone.restQuat);

        glove.prevPos.copy(bone.node.position);
        glove.prevRest.copy(bone.restPos);
        glove.prevDelta.copy(glove.swing);
        if (bone.restDir) {
          glove.prevDir.copy(bone.restDir).applyQuaternion(glove.swing);
        }
      }
    }

    glove.freshStart = false;

    const cuff = cuffRef.current;
    if (cuff) {
      cuff.visible = true;
      cuff.quaternion.setFromUnitVectors(AXIS_Z, glove.frame.up);
      cuff.position
        .copy(current[0])
        .addScaledVector(glove.frame.up, -0.06 * glove.span);
      cuff.scale.setScalar(0.3 * glove.span * glove.shown);
      const band = cuff.material as MeshStandardMaterial;
      band.color.copy(glove.cuffTint);
      band.emissive.copy(glove.cuffTint);
      band.emissiveIntensity = 0.18 + 0.45 * glove.grab + 0.12 * glove.presence;
    }
  });

  return (
    <>
      <group ref={modelRef}>
        <primitive object={handModel} />
      </group>
      <mesh ref={cuffRef}>
        <torusGeometry args={[1, 0.34, 14, 32]} />
        <meshStandardMaterial
          color={HAND_ACCENTS[handedness]}
          emissive={HAND_ACCENTS[handedness]}
          roughness={0.32}
          metalness={0.18}
        />
      </mesh>
    </>
  );
}

export function HandGloves({
  handsRef,
}: {
  handsRef: RefObject<TrackedHand[]>;
}) {
  return (
    <>
      <GloveHand handedness="Left" handsRef={handsRef} />
      <GloveHand handedness="Right" handsRef={handsRef} />
    </>
  );
}
