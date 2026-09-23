"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { InstancedMesh, Mesh, MeshToonMaterial } from "three";
import {
  Color,
  DataTexture,
  Matrix4,
  NearestFilter,
  Quaternion,
  RedFormat,
  Vector3,
} from "three";
import {
  HAND_CONNECTIONS,
  landmarkToWorld,
  type Handedness,
  type TrackedHand,
} from "@/hooks/useHandTracking";
import {
  LOCKED_SPAN,
  deepen,
  lockSpan,
  makeFrame,
  palmFrame,
} from "@/hooks/palmFrame";

/**
 * The hand, built where the tracking says it is.
 *
 * What was here before posed a rigged glTF hand: it read a bind pose out of
 * the skeleton, walked each finger as a chain, solved a rotation per bone and
 * held every joint inside limits. Every part of that was there to serve one
 * requirement — a skinned mesh has fixed bone lengths, and they have to be
 * respected — and that requirement is what made it fragile:
 *
 *   - Fixed lengths mean depth has to be invented, because a bone foreshortened
 *     on screen must have gone somewhere. Inventing it needs a sign, and the
 *     sign is unknowable exactly where it matters most.
 *   - A skeleton has a handedness of its own, so the right one of a mirrored
 *     pair has to be chosen from the landmarks, and chosen again whenever the
 *     hand turns. Choosing wrong rebuilds the rig mid-gesture.
 *   - Solving rotations down a chain compounds error: a wrong angle at a
 *     knuckle moves every bone past it, and a wrong angle at the wrist moves
 *     the whole hand.
 *
 * None of that exists here. There is no skeleton, so there is nothing to
 * retarget: each segment is drawn between the two landmarks it spans, and each
 * joint is drawn where its landmark is. A left hand comes out left because its
 * landmarks are a left hand's. A finger that cannot be read clearly is wrong on
 * its own rather than dragging the hand with it.
 *
 * The cost, stated plainly: fingers change apparent length as they turn toward
 * the camera, because nothing here forces them to keep one. That is the same
 * fact the old code spent four hundred lines fighting, and letting it be true
 * is what buys everything above.
 *
 * It cannot look like flesh, so it does not try: pale ceramic bones on brass
 * joints, an automaton's hand rather than a person's.
 */

/**
 * Drawn colours rather than material ones, and pitched bright: cel shading
 * steps everything down toward the dark end, so a colour picked to look right
 * flat comes out muddy once it is on the ramp.
 */
const BONE_COLOR = new Color("#fbf0d9");
const BONE_RESTING = new Color("#c2b7a2");
const JOINT_COLOR = new Color("#f2ab2c");
const JOINT_RESTING = new Color("#8f6524");
const GRAB_COLOR = new Color("#f0b429");

/** A cuff per hand, far enough apart in tone to tell which is which. */
const HAND_ACCENTS: Record<Handedness, string> = {
  Left: "#d98c3c",
  Right: "#7a3b1e",
};

/**
 * The ramp every surface here is shaded against: four flat steps instead of a
 * smooth falloff.
 *
 * This is what makes it read as a drawing rather than as a render. Toon
 * shading also drops metalness and reflections, so the brass stops being
 * literal metal and becomes the colour gold is drawn with — which is the
 * trade, and for a cartoon it is the right way round.
 */
function toonRamp() {
  const steps = new Uint8Array([86, 150, 214, 255]);
  const ramp = new DataTexture(steps, steps.length, 1, RedFormat);
  ramp.minFilter = NearestFilter;
  ramp.magFilter = NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const JOINTS = 21;
const BONES = HAND_CONNECTIONS.length;

/**
 * How thick each joint is, as a share of the hand's locked span.
 *
 * Written out per landmark rather than derived, because a hand is not uniform:
 * knuckles are wider than the bones either side of them, which is what makes a
 * jointed hand read as jointed, and everything narrows toward the fingertips.
 */
const JOINT_SIZE: readonly number[] = [
  0.135, // 0  wrist
  0.095, 0.086, 0.078, 0.07, // 1-4   thumb
  0.1, 0.088, 0.079, 0.07, // 5-8   index
  0.103, 0.09, 0.08, 0.071, // 9-12  middle
  0.098, 0.086, 0.077, 0.068, // 13-16 ring
  0.088, 0.079, 0.072, 0.064, // 17-20 pinky
];

/** The five bones that outline the palm rather than a finger. */
const PALM_BONES = new Set([4, 8, 12, 16, 17]);

const SPEED_FULL = 3.2;
const REST_RATE = 2.6;
const SHOWN_FLOOR = 0.02;
const PAINT_RATE = 9;

/**
 * The numbers that decide how the hand feels, read at runtime so they can be
 * dialled against a live camera instead of guessed at and rebuilt.
 *
 * Shorter than it was. Everything that existed to prop up the retargeting —
 * how much depth to believe when orienting the model, how far a finger could
 * be trusted to reach, how gently the whole hand was allowed to turn — went
 * with the retargeting.
 */
export const handTuning = {
  /** Smoothing in e-folds per second: heavy at rest, light once moving. */
  stillRate: 16,
  movingRate: 90,
  /** Depth is the noisiest axis tracking reports, so it is damped harder. */
  depthDamping: 0.75,
  /**
   * How far to stretch the reported depth, about the wrist.
   *
   * MediaPipe reports depth at roughly a fifth of the scale of the other two
   * axes. `WORLD_Z` in the tracker undoes some of that, but it was set when
   * depth was only ever used for the shape of a finger, and it is deliberately
   * timid — which left the hand nearly flat. A flat hand is a hand whose
   * fingers never pass behind one another, so nothing ever occludes anything
   * and the whole thing reads as a sticker.
   *
   * Above 1 on purpose. At 1 the hand is as deep as `WORLD_Z` leaves it; the
   * default here opens that out until a finger folded behind the palm is
   * genuinely behind it and gets hidden by it.
   */
  depthScale: 2.2,
  /** Arriving is quick, leaving gentler, so a dropped frame is not a flicker. */
  showRate: 14,
  hideRate: 5,
};

/** Presentation switches, settled by looking rather than by reasoning. */
export const handView = {
  /** Draw the palm plate. Off leaves the bare linkage. */
  showPalm: true,
};

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

function createState(handedness: Handedness) {
  return {
    /** Where tracking says the joints are, and where they are being drawn. */
    target: Array.from({ length: JOINTS }, () => new Vector3()),
    current: Array.from({ length: JOINTS }, () => new Vector3()),
    prevWrist: new Vector3(),
    seeded: false,
    shown: 0,
    presence: 0,
    grab: 0,
    frame: makeFrame(),
    accent: new Color(HAND_ACCENTS[handedness]),
    cuffTint: new Color(HAND_ACCENTS[handedness]),
    boneTint: new Color(),
    jointTint: new Color(),
    matrix: new Matrix4(),
    quat: new Quaternion(),
    dir: new Vector3(),
    mid: new Vector3(),
    size: new Vector3(),
    v: new Vector3(),
  };
}

export function RobotHand({
  handedness,
  handsRef,
}: {
  handedness: Handedness;
  handsRef: RefObject<TrackedHand[]>;
}) {
  const bonesRef = useRef<InstancedMesh>(null);
  const jointsRef = useRef<InstancedMesh>(null);
  const palmRef = useRef<Mesh>(null);
  const cuffRef = useRef<Mesh>(null);
  const stateRef = useRef<ReturnType<typeof createState> | null>(null);

  // Written once: the thickness of each bone comes from the thinner of the two
  // joints it runs between, so a bone never looks fatter than the knuckle it
  // leaves. Palm struts are squarer, because they are a chassis rather than a
  // finger.
  const ramp = useMemo(() => toonRamp(), []);
  const boneSize = useMemo(
    () =>
      HAND_CONNECTIONS.map(([a, b], i) => {
        const thinner = Math.min(JOINT_SIZE[a], JOINT_SIZE[b]);
        return thinner * (PALM_BONES.has(i) ? 0.72 : 0.86);
      }),
    [],
  );

  useFrame((frameState, delta) => {
    const bones = bonesRef.current;
    const joints = jointsRef.current;
    if (!bones || !joints) return;

    const dt = Math.min(delta, 0.05);
    const time = frameState.clock.elapsedTime;
    const hand = (handsRef.current ?? []).find(
      (entry) => entry.handedness === handedness,
    );
    const tracked = hand?.smoothedLandmarks.length === JOINTS;
    const s = (stateRef.current ??= createState(handedness));
    const { target, current } = s;
    const paint = 1 - Math.exp(-PAINT_RATE * dt);

    if (tracked && hand) {
      for (let i = 0; i < JOINTS; i++) {
        const world = landmarkToWorld(hand.smoothedLandmarks[i]);
        target[i].set(world.x, world.y, world.z);
      }
      // Lock the visual size. Apparent hand size grows and shrinks with
      // distance to the camera, and following it made the hand pulse.
      lockSpan(target, s.v);
      // Open the depth out, so fingers are far enough apart along the view
      // axis to pass behind one another and be hidden when they do.
      deepen(target, handTuning.depthScale);
    } else if (hand) {
      // Pointer fallback: a cursor and no hand shape, so the resting pose
      // stands in and is hung off the cursor.
      const breath = 1 + Math.sin(time * 1.25) * 0.018;
      for (let i = 0; i < JOINTS; i++) {
        const [x, y, z] = REST_POSE[i];
        target[i].set(x, y, z).multiplyScalar(breath);
      }
      // Through the same rescaling as a tracked hand rather than a factor of
      // its own, so the two are the same size by construction and cannot drift
      // apart when one of them is edited.
      lockSpan(target, s.v);
      // Line the pinch up with what the grab logic actually tests.
      s.v.copy(target[4]).add(target[8]).multiplyScalar(0.5);
      s.v.sub(
        s.mid.set(hand.cursor.x, hand.cursor.y, hand.cursor.z),
      );
      for (const point of target) point.sub(s.v);
    }

    s.shown +=
      ((hand ? 1 : 0) - s.shown) *
      (1 - Math.exp(-(hand ? handTuning.showRate : handTuning.hideRate) * dt));
    const onStage = s.shown > SHOWN_FLOOR;
    if (!onStage) s.seeded = false;

    // Smooth hard at rest and let go as the hand picks up speed: tracking
    // jitters most when the hand is holding still, which is exactly when the
    // eye notices.
    const speed = s.seeded ? s.prevWrist.distanceTo(target[0]) / dt : 999;
    s.prevWrist.copy(target[0]);
    const eased = Math.min(1, speed / SPEED_FULL);
    const rate = tracked
      ? handTuning.stillRate +
        (handTuning.movingRate - handTuning.stillRate) * eased
      : hand
        ? handTuning.movingRate
        : REST_RATE;
    const follow = 1 - Math.exp(-rate * dt);
    const depthFollow = 1 - Math.exp(-rate * handTuning.depthDamping * dt);

    for (let i = 0; i < JOINTS; i++) {
      if (s.seeded) {
        current[i].x += (target[i].x - current[i].x) * follow;
        current[i].y += (target[i].y - current[i].y) * follow;
        current[i].z += (target[i].z - current[i].z) * depthFollow;
      } else {
        current[i].copy(target[i]);
      }
    }
    s.seeded = true;

    bones.visible = onStage;
    joints.visible = onStage;
    if (palmRef.current) palmRef.current.visible = onStage && handView.showPalm;
    if (cuffRef.current) cuffRef.current.visible = onStage;
    if (!onStage) return;

    s.presence += ((hand ? 1 : 0) - s.presence) * paint;
    s.grab += ((hand?.isGrabbing ? 1 : 0) - s.grab) * paint;

    // One segment per bone, placed between the two landmarks it spans. This is
    // the whole of the posing: no rotation is solved, only read.
    for (let i = 0; i < BONES; i++) {
      const [a, b] = HAND_CONNECTIONS[i];
      s.dir.copy(current[b]).sub(current[a]);
      const length = s.dir.length();
      s.mid.copy(current[a]).add(current[b]).multiplyScalar(0.5);
      if (length < 1e-5) {
        s.quat.identity();
      } else {
        s.quat.setFromUnitVectors(AXIS_Y, s.dir.divideScalar(length));
      }
      const thick = boneSize[i] * s.shown;
      s.matrix.compose(s.mid, s.quat, s.size.set(thick, length, thick));
      bones.setMatrixAt(i, s.matrix);
    }

    for (let i = 0; i < JOINTS; i++) {
      const size = JOINT_SIZE[i] * s.shown;
      s.matrix.compose(current[i], s.quat.identity(), s.size.setScalar(size));
      joints.setMatrixAt(i, s.matrix);
    }

    bones.instanceMatrix.needsUpdate = true;
    joints.instanceMatrix.needsUpdate = true;

    // The palm plate and the cuff both want a frame. Note what this frame can
    // and cannot cost now: it orients two decorative pieces, so if depth noise
    // shakes it, two decorative pieces shake. It used to orient the entire
    // hand.
    palmFrame(current[0], current[9], current[5], current[17], 1, s.frame);

    const palm = palmRef.current;
    if (palm) {
      // Sized from the hand in front of it rather than from constants: a hand
      // turning edge-on narrows its own knuckle span, so the plate narrows
      // with it instead of hanging at full width in a meaningless plane.
      const width = Math.max(s.frame.acrossSpan, 1e-3) * 1.06;
      const height = Math.max(s.frame.upSpan, 1e-3) * 0.66;
      // Between the wrist and the knuckles, biased toward the knuckles, which
      // is where the breadth of a hand actually is.
      s.mid
        .copy(current[0])
        .addScaledVector(s.frame.up, height * 0.82)
        .addScaledVector(s.frame.side, 0);
      palm.position.copy(s.mid);
      palm.quaternion.setFromRotationMatrix(
        s.matrix.makeBasis(s.frame.side, s.frame.up, s.frame.normal),
      );
      palm.scale.set(
        width * s.shown,
        height * s.shown,
        LOCKED_SPAN * 0.05 * s.shown,
      );
    }

    const cuff = cuffRef.current;
    if (cuff) {
      cuff.quaternion.setFromUnitVectors(AXIS_Z, s.frame.up);
      cuff.position
        .copy(current[0])
        .addScaledVector(s.frame.up, -0.07 * LOCKED_SPAN);
      cuff.scale.setScalar(0.3 * LOCKED_SPAN * s.shown);
    }

    // Colour says two things at once: whether the hand is being seen, and
    // whether it is holding something.
    s.boneTint.copy(BONE_RESTING).lerp(BONE_COLOR, s.presence);
    s.jointTint.copy(JOINT_RESTING).lerp(JOINT_COLOR, s.presence);
    s.jointTint.lerp(GRAB_COLOR, s.grab * 0.7);
    s.cuffTint.copy(s.accent).lerp(GRAB_COLOR, s.grab);

    const boneMaterial = bones.material as MeshToonMaterial;
    boneMaterial.color.copy(s.boneTint);
    boneMaterial.emissive.copy(GRAB_COLOR);
    boneMaterial.emissiveIntensity = 0.16 * s.grab;

    const jointMaterial = joints.material as MeshToonMaterial;
    jointMaterial.color.copy(s.jointTint);
    jointMaterial.emissive.copy(GRAB_COLOR);
    jointMaterial.emissiveIntensity = 0.3 * s.grab;

    if (palm) (palm.material as MeshToonMaterial).color.copy(s.boneTint);
    if (cuff) (cuff.material as MeshToonMaterial).color.copy(s.cuffTint);
  });

  return (
    <group>
      <instancedMesh
        ref={bonesRef}
        args={[undefined, undefined, BONES]}
        visible={false}
        frustumCulled={false}
        castShadow
      >
        {/* Barely tapered: a cartoon hand has sausages for fingers, not
            spindles. A capsule would be the obvious shape and is the wrong
            one — scaling it to a bone's length stretches its caps into eggs.
            A plain cylinder is scaled cleanly, and the joint spheres sit
            proud of it at both ends, which rounds it off for free. The taper
            still has a direction: connections run parent to child, so the
            narrow end is always the one nearer the fingertip. */}
        <cylinderGeometry args={[0.9, 1, 1, 12]} />
        <meshToonMaterial color={BONE_COLOR} gradientMap={ramp} />
      </instancedMesh>

      <instancedMesh
        ref={jointsRef}
        args={[undefined, undefined, JOINTS]}
        visible={false}
        frustumCulled={false}
        castShadow
      >
        <sphereGeometry args={[1, 14, 10]} />
        <meshToonMaterial color={JOINT_COLOR} gradientMap={ramp} />
      </instancedMesh>

      {/* A machined plate the linkage is mounted on, rather than a brick. */}
      <RoundedBox
        ref={palmRef}
        args={[1, 1, 1]}
        radius={0.17}
        smoothness={3}
        visible={false}
        castShadow
      >
        <meshToonMaterial color={BONE_COLOR} gradientMap={ramp} />
      </RoundedBox>

      <mesh ref={cuffRef} visible={false} castShadow>
        <torusGeometry args={[1, 0.34, 10, 22]} />
        <meshToonMaterial color={HAND_ACCENTS[handedness]} gradientMap={ramp} />
      </mesh>
    </group>
  );
}

export function HandGloves({
  handsRef,
}: {
  handsRef: RefObject<TrackedHand[]>;
}) {
  return (
    <>
      <RobotHand handedness="Left" handsRef={handsRef} />
      <RobotHand handedness="Right" handsRef={handsRef} />
    </>
  );
}
