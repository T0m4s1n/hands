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
type Limits = { splay: number; curl: number; hyper: number };

const HINGE: Limits = { splay: 0.06, curl: 1.95, hyper: 0.1 };
const KNUCKLE: Limits = { splay: 0.38, curl: 1.65, hyper: 0.22 };
const TIP_JOINT: Limits = { splay: 0.06, curl: 1.5, hyper: 0.1 };
const THUMB_BASE: Limits = { splay: 0.7, curl: 1.0, hyper: 0.55 };
const THUMB_MID: Limits = { splay: 0.35, curl: 1.2, hyper: 0.25 };
const THUMB_END: Limits = { splay: 0.12, curl: 1.4, hyper: 0.2 };

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

// Hand size measured across several axes, each divided by its nominal length in
// palm spans. The largest estimate wins, so a palm turned edge-on to the camera
// does not shrink the glove.
const SPAN_PROBES: readonly (readonly [number, number, number])[] = [
  [0, 9, 1],
  [0, 5, 0.995],
  [0, 17, 1.068],
  [5, 17, 1.043],
];

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

const DEFAULT_SPAN = 0.85;
const MIN_SPAN = 0.35;
const MAX_SPAN = 3;
const FOLLOW_RATE = 32;
const SPEED_FULL = 3.2;
const REST_RATE = 2.6;
const SHOWN_FLOOR = 0.02;
/** Knuckle span across the palm, in palm spans. */
const PALM_WIDTH = 1.043;

/**
 * The handful of numbers that decide how the hand feels, gathered in one place
 * and read at runtime so they can be dialled in against a live camera instead
 * of guessed at and rebuilt. The defaults are the tuned values.
 */
export const handTuning = {
  /** Smoothing in e-folds per second: heavy at rest, light once moving, so
   *  jitter dies without the hand feeling laggy. */
  stillRate: 7,
  movingRate: 34,
  /** Depth is the noisiest axis tracking reports, so it is damped harder. */
  depthDamping: 0.45,
  /** Below this fraction of an axis's true length the palm counts as face-on,
   *  so noise cannot manufacture a rotation out of nothing. */
  palmReach: 0.92,
  /** Reported depth, relative to axis length, at which a lean counts as full.
   *  Tracking compresses depth roughly fivefold, so this is small. */
  depthLean: 0.12,
  /** How fast the palm settles into a new orientation. */
  turnRate: 9,
  /** The same dead zone for finger bones. Generous on purpose: the player's
   *  proportions never match the model's, and reading that as foreshortening
   *  would leave every finger permanently half curled. */
  fingerReach: 0.82,
  /** Hand size rises fast to what is seen face-on and falls only slowly. */
  spanDecay: 0.06,
  /** Arriving is quick, leaving gentler, so a dropped frame is not a flicker. */
  showRate: 14,
  hideRate: 5,
};
// How far out of the palm plane the thumb must sit before the reading counts,
// and how many agreeing frames settle it. Depth arrives heavily compressed, so
// the bar is low — but the sign is what matters, and it holds steady.
const CHIRALITY_FLOOR = 0.012;
const CHIRALITY_FRAMES = 12;
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
    chiralityLocked: false,
    chiralityGuess: 0,
    chiralityAgreed: 0,
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
    up: new Vector3(),
    side: new Vector3(),
    normal: new Vector3(),
    across: new Vector3(),
    dir: new Vector3(),
    quat: new Quaternion(),
    swing: new Quaternion(),
    delta: new Quaternion(),
    prevDelta: new Quaternion(),
    basis: new Matrix4(),
    inverse: new Matrix4(),
    prevWrist: new Vector3(),
    smoothed: new Quaternion(),
    upDepth: 0,
    acrossDepth: 0,
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
// finger curling toward the camera collapses into a near-zero vector that is
// mostly noise — which is exactly why closing a fist fell apart. The sideways
// part of the bone is trustworthy though, and the bone's length is known, so
// the missing depth is just the remaining side of a right triangle. Of the two
// possible signs, take the one folding toward the palm: the only way a finger
// actually bends.
function trackedDirection(
  glove: GloveState,
  points: Vector3[],
  aim: readonly [number, number],
  restLength: number,
  depthSign: number,
): Vector3 {
  glove.dir.copy(points[aim[1]]).sub(points[aim[0]]);
  glove.perp
    .copy(glove.dir)
    .addScaledVector(glove.viewAxis, -glove.dir.dot(glove.viewAxis));
  const sideways = glove.perp.length();
  if (sideways < 1e-5) {
    return glove.dir.copy(glove.viewAxis).multiplyScalar(depthSign);
  }

  const reach = restLength * handTuning.fingerReach;
  const depth =
    sideways < reach ? Math.sqrt(reach * reach - sideways * sideways) : 0;
  return glove.dir
    .copy(glove.perp)
    .addScaledVector(glove.viewAxis, depthSign * depth)
    .normalize();
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * How much depth a palm axis of known length must have, given the part of it
 * that lies across the image. Note the shape of it: the derivative blows up as
 * the depth approaches zero, which is exactly the common case of a palm facing
 * the camera. Measurement noise there would swing the answer wildly, so the
 * caller both leaves a dead zone (handTuning.palmReach) and eases toward this over time
 * rather than snapping to it.
 */
function depthFor(x: number, y: number, length: number): number {
  const reach = length * handTuning.palmReach;
  const flat = Math.hypot(x, y);
  return flat < reach ? Math.sqrt(reach * reach - flat * flat) : 0;
}

/**
 * How far, and which way, an axis leans out of the image, from -1 to 1. The
 * reported depth is far too compressed to use as a length, but it does say
 * which way and roughly how confidently — and at zero it says "square to the
 * camera", which is the answer a bare sign could never give.
 */
function lean(z: number, length: number): number {
  return clamp(z / (length * handTuning.depthLean), -1, 1);
}

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
  out: Vector3,
): Vector3 {
  const splay = clamp(
    Math.asin(clamp(raw.dot(hinge), -1, 1)),
    -limits.splay,
    limits.splay,
  );

  // Both directions flattened into the joint's bend plane.
  glove.flatParent
    .copy(parentDir)
    .addScaledVector(hinge, -parentDir.dot(hinge));
  if (glove.flatParent.lengthSq() < 1e-8) return out.copy(parentDir);
  glove.flatParent.normalize();

  glove.flatTarget.copy(raw).addScaledVector(hinge, -raw.dot(hinge));
  if (glove.flatTarget.lengthSq() < 1e-8) glove.flatTarget.copy(glove.flatParent);
  else glove.flatTarget.normalize();

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

  // Which of the two a hand needs is measured from its landmarks the first time
  // it is seen clearly, not assumed. Until then either will do — a hand that
  // has never been tracked is only showing a resting pose.
  const [picked, setPicked] = useState(0);
  const handModel = models[picked].clone;

  // The resting pose is a fixed set of numbers with a chirality of its own, so
  // it gets flipped to match whichever model ended up chosen.
  const poseMirror = models[picked].chirality === REST_CHIRALITY ? 1 : -1;
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
    const follow =
      1 - Math.exp(-(tracked || hand ? FOLLOW_RATE : REST_RATE) * dt);
    const paint = 1 - Math.exp(-PAINT_RATE * dt);

    if (tracked && hand) {
      for (let i = 0; i < 21; i++) {
        const world = landmarkToWorld(hand.smoothedLandmarks[i]);
        target[i].set(world.x, world.y, world.z);
      }
      let measured = 0;
      for (const [a, b, nominal] of SPAN_PROBES) {
        measured = Math.max(measured, target[a].distanceTo(target[b]) / nominal);
      }
      measured = Math.min(MAX_SPAN, Math.max(MIN_SPAN, measured));
      // Turning the hand shortens every projection at once, so a span that
      // followed them down would shrink the hand and cancel out the depth
      // rebuild below. It rises quickly to the size seen face-on and only
      // drifts down slowly, which is the size the hand actually is.
      const spanRate = measured > glove.span ? follow : follow * handTuning.spanDecay;
      glove.span += (measured - glove.span) * spanRate;
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
      // wherever it was last seen.
      glove.seeded = false;
      glove.turned = false;
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

    // Settle which of the two models this hand needs from a run of frames that
    // agree, then leave it alone. One reading is not enough — a hand turned
    // edge-on barely shows which side its thumb is on — and re-reading forever
    // would risk swapping the model in the middle of a gesture.
    if (tracked && !glove.chiralityLocked) {
      const reading = handednessVolume(
        current[0],
        current[5],
        current[17],
        current[9],
        current[1],
        glove.across,
        glove.up,
        glove.side,
      );
      const sign = Math.sign(reading);
      if (Math.abs(reading) < CHIRALITY_FLOOR || sign === 0) {
        glove.chiralityAgreed = 0;
      } else if (sign === glove.chiralityGuess) {
        glove.chiralityAgreed += 1;
      } else {
        glove.chiralityGuess = sign;
        glove.chiralityAgreed = 1;
      }

      if (glove.chiralityAgreed >= CHIRALITY_FRAMES) {
        glove.chiralityLocked = true;
        const match = models.findIndex(
          (entry) => entry.chirality === glove.chiralityGuess,
        );
        if (match >= 0 && match !== picked) setPicked(match);
      }
    }

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

    // Palm frame of the tracked hand: up runs wrist → middle knuckle, normal
    // comes out of the back of the hand.
    //
    // Both axes get their depth rebuilt first. Tracking flattens depth to a
    // fifth of the scale it reports x and y on, so a hand turning about its own
    // axis barely registers and the palm ends up permanently facing the camera.
    // The span of each axis is known, so the missing depth is recoverable — the
    // same trick the finger bones use, and what makes wrist twist and tilt read.
    //
    // The reported depth decides how far to lean, and the geometry decides how
    // far that lean actually reaches. Taking only the sign of the report would
    // be worse than useless: a palm square to the camera reports noise around
    // zero, and committing to a sign there would twist the hand into a pose it
    // is not in — which then folds the fingers the wrong way, since they close
    // toward whichever side the palm ends up facing.
    const turn = 1 - Math.exp(-handTuning.turnRate * dt);

    glove.up.copy(current[9]).sub(current[0]);
    glove.upDepth +=
      (depthFor(glove.up.x, glove.up.y, glove.span) *
        lean(glove.up.z, glove.span) -
        glove.upDepth) *
      turn;
    glove.up.z = glove.upDepth;
    glove.up.normalize();

    const acrossSpan = glove.span * PALM_WIDTH;
    glove.across.copy(current[17]).sub(current[5]);
    glove.acrossDepth +=
      (depthFor(glove.across.x, glove.across.y, acrossSpan) *
        lean(glove.across.z, acrossSpan) -
        glove.acrossDepth) *
      turn;
    glove.across.z = glove.acrossDepth;

    glove.normal.crossVectors(glove.across, glove.up);
    if (glove.normal.lengthSq() < 1e-8) glove.normal.copy(AXIS_Z);
    glove.normal.normalize();
    glove.side.crossVectors(glove.up, glove.normal).normalize();
    glove.basis.makeBasis(glove.side, glove.up, glove.normal);

    // Place the whole model so its wrist lands on the tracked wrist, turned
    // into the tracked palm frame and scaled to the tracked hand size. The
    // orientation gets its own smoothing pass: a wobbling palm reads as a
    // broken hand far more than a slightly late one does.
    model.visible = onStage;
    if (!onStage) {
      if (cuffRef.current) cuffRef.current.visible = false;
      return;
    }
    const scale = (glove.span / rig.modelSpan) * glove.shown;
    glove.quat.setFromRotationMatrix(glove.basis).multiply(rig.modelBasisInv);
    if (glove.turned) glove.smoothed.slerp(glove.quat, posFollow);
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

    // The camera axis is the one tracking is unreliable along, and the palm
    // side of it is where fingers are allowed to fold.
    glove.viewAxis.set(0, 0, 1).transformDirection(glove.inverse);
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
            glove.aimed,
          );
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

    const cuff = cuffRef.current;
    if (cuff) {
      cuff.visible = true;
      cuff.quaternion.setFromUnitVectors(AXIS_Z, glove.up);
      cuff.position.copy(current[0]).addScaledVector(glove.up, -0.06 * glove.span);
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
