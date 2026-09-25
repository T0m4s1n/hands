"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { Color, Matrix4, Quaternion, Vector3 } from "three";
import { type Handedness, type TrackedHand } from "@/hooks/useHandTracking";
import { keepFacing, makeFrame, palmFrame } from "@/hooks/palmFrame";
import { handTuning } from "@/hooks/handPose";
import { createHandToon, paintHandToon } from "@/components/handToon";
import {
  GLOVE_POS_DEAD,
  GLOVE_TURN_DEAD,
  gloveChaseRate,
  gloveCurl,
  gloveFollow,
  glovePhase,
  gloveSideSign,
} from "@/components/coffee/gloveVisual";
import {
  composeFolds,
  emptyGloveHold,
  gripBlend,
  gripForTool,
  GRIPS,
  mixGripScalar,
  poseGloveFinger,
  seekHandle,
  type GloveHold,
} from "@/components/coffee/gloveGrip";
import { scoopDumpPose } from "@/components/coffee/beanDump";
import { gloveFolds } from "@/hooks/handCurl";
import { HAND_HOVER } from "@/hooks/handAim";

export { handTuning, handView } from "@/hooks/handPose";

/**
 * Designed comic glove. Tracking decides where it sits and how closed
 * each finger is; the silhouette itself is a puppet, not a reconstruction
 * of twenty-one noisy landmarks. A real fist folds the mitt shut.
 */

const GLOVE_COLOR = new Color("#fff6ee");
const GLOVE_RESTING = new Color("#efe0cc");
const GRAB_COLOR = new Color("#f0b429");
const HAND_ACCENTS: Record<Handedness, string> = {
  Left: "#f2c48a",
  Right: "#e8a878",
};

const IDLE_HOLD = emptyGloveHold();

const FINGERS = [
  { name: "thumb", x: -0.2, y: 0.04, z: 0.03, spread: 0.82, length: 0.3, thick: 0.072, thumb: true },
  { name: "index", x: -0.11, y: 0.2, z: 0, spread: 0.12, length: 0.38, thick: 0.06, thumb: false },
  { name: "middle", x: 0, y: 0.22, z: 0, spread: 0, length: 0.42, thick: 0.064, thumb: false },
  { name: "ring", x: 0.1, y: 0.2, z: 0, spread: -0.1, length: 0.38, thick: 0.058, thumb: false },
  { name: "pinky", x: 0.18, y: 0.16, z: 0, spread: -0.22, length: 0.3, thick: 0.05, thumb: false },
] as const;

function createState(handedness: Handedness) {
  return {
    pos: new Vector3(),
    targetPos: new Vector3(),
    quat: new Quaternion(),
    targetQuat: new Quaternion(),
    matrix: new Matrix4(),
    frame: makeFrame(),
    lastNormal: new Vector3(),
    lightDir: new Vector3(),
    wrist: new Vector3(),
    middle: new Vector3(),
    index: new Vector3(),
    pinky: new Vector3(),
    aim: new Vector3(),
    dumpAxis: new Vector3(1, 0, 0),
    dumpQuat: new Quaternion(),
    palmQuat: new Quaternion(),
    accent: new Color(HAND_ACCENTS[handedness]),
    cuffTint: new Color(HAND_ACCENTS[handedness]),
    gloveTint: new Color(),
    shown: 0,
    grab: 0,
    folds: [0, 0, 0, 0, 0],
    oppose: 0,
    squeeze: 0,
    seeded: false,
    seedsReady: false,
  };
}

export function RobotHand({
  handedness,
  handsRef,
  holdRef,
  active,
}: {
  handedness: Handedness;
  handsRef: RefObject<TrackedHand[]>;
  holdRef?: RefObject<GloveHold>;
  active: boolean;
}) {
  const rootRef = useRef<Group>(null);
  const fingerRefs = useRef<(Group | null)[]>([]);
  const midRefs = useRef<(Group | null)[]>([]);
  const tipRefs = useRef<(Group | null)[]>([]);
  const palmRef = useRef<Mesh>(null);
  const cuffRef = useRef<Mesh>(null);
  const stateRef = useRef<ReturnType<typeof createState> | null>(null);

  const materials = useMemo(
    () => ({
      glove: createHandToon(GLOVE_COLOR, 0.36),
      cuff: createHandToon(HAND_ACCENTS[handedness], 0.24),
    }),
    [handedness],
  );
  useEffect(() => {
    return () => {
      materials.glove.dispose();
      materials.cuff.dispose();
    };
  }, [materials]);

  useFrame((frameState, delta) => {
    const root = rootRef.current;
    if (!root) return;
    const dt = Math.min(delta, 0.05);
    const hand = (handsRef.current ?? []).find(
      (entry) => entry.handedness === handedness,
    );
    const phase = glovePhase(active, hand);
    const s = (stateRef.current ??= createState(handedness));

    const hold = holdRef?.current ?? IDLE_HOLD;
    const mine = hold.handedness === handedness && (hold.holding || hold.near);
    const blend = mine ? gripBlend(hold.near, hold.holding) : 0;
    const seek = mine ? seekHandle(hold.near, hold.holding) : 0;
    const grip = GRIPS[gripForTool(hold.tool)];

    if (hand) {
      const cursorX = hand.cursor.x;
      const cursorY = hand.cursor.y;
      s.targetPos.set(
        cursorX + (hold.gripX - cursorX) * seek,
        cursorY + (hold.gripY - cursorY) * seek,
        HAND_HOVER,
      );
      const posed = hand.posed;
      if (posed && posed.length >= 18) {
        const seed = s.seedsReady ? 1 - Math.exp(-16 * dt) : 1;
        const pull = (into: Vector3, x: number, y: number, z: number) => {
          s.aim.set(x, y, z);
          if (!s.seedsReady) into.copy(s.aim);
          else into.lerp(s.aim, seed);
        };
        pull(s.wrist, posed[0].x, posed[0].y, posed[0].z);
        pull(s.middle, posed[9].x, posed[9].y, posed[9].z);
        pull(s.index, posed[5].x, posed[5].y, posed[5].z);
        pull(s.pinky, posed[17].x, posed[17].y, posed[17].z);
        s.seedsReady = true;
        // Depth is the noisiest axis. Believing it fully spins the whole mitt.
        palmFrame(s.wrist, s.middle, s.index, s.pinky, 0.28, s.frame);
        keepFacing(s.frame, s.lastNormal);
        if (s.frame.upSpan > 0.12 && s.frame.acrossSpan > 0.08) {
          s.matrix.makeBasis(s.frame.side, s.frame.up, s.frame.normal);
          s.palmQuat.setFromRotationMatrix(s.matrix);
        }
      }
      s.targetQuat.copy(s.palmQuat);
      if (hold.dump > 0.001) {
        const pour = scoopDumpPose(hold.dump);
        s.dumpQuat.setFromAxisAngle(s.dumpAxis, pour.roll);
        s.targetQuat.multiply(s.dumpQuat);
      }
    }

    const want = phase === "follow" ? 1 : 0;
    s.shown = gloveFollow(
      s.shown,
      want,
      want ? handTuning.showRate : handTuning.hideRate,
      dt,
    );
    s.grab = gloveFollow(s.grab, hand?.isGrabbing || hold.holding ? 1 : 0, 18, dt);
    const wantFolds = composeFolds(
      gloveFolds(
        hand?.posed ?? hand?.smoothedLandmarks,
        Boolean(hand?.isGrabbing || hold.holding),
      ),
      grip,
      blend,
    );
    for (let i = 0; i < s.folds.length; i++) {
      const target = wantFolds[i] ?? 0;
      const closing = target > (s.folds[i] ?? 0);
      s.folds[i] = gloveFollow(s.folds[i], target, closing ? 26 : 12, dt);
    }
    const wantOppose = mixGripScalar(s.folds[0] ?? 0, grip.oppose, blend);
    const wantSqueeze = mixGripScalar((s.grab ?? 0) * 0.18, grip.squeeze, blend);
    s.oppose = gloveFollow(s.oppose, wantOppose, 16, dt);
    s.squeeze = gloveFollow(s.squeeze, wantSqueeze, 16, dt);
    const fade = Math.min(1, Math.max(0, s.shown));
    const onStage = fade > 0.05;
    root.visible = onStage;
    if (!onStage) {
      s.seeded = false;
      s.seedsReady = false;
      return;
    }

    if (!s.seeded) {
      s.pos.copy(s.targetPos);
      s.quat.copy(s.targetQuat);
      s.seeded = true;
    } else {
      const live = hand?.tracking === "live";
      const travel = s.pos.distanceTo(s.targetPos);
      const turn = 1 - Math.abs(s.quat.dot(s.targetQuat));
      const locked = blend > 0.7;
      const posRate = live
        ? gloveChaseRate(
            Math.max(0, travel - (locked ? 0 : GLOVE_POS_DEAD)),
            locked ? 28 : 12,
            locked ? 72 : 42,
            0.22,
          )
        : 10;
      const rotRate = live
        ? gloveChaseRate(
            Math.max(0, turn - GLOVE_TURN_DEAD),
            6,
            22,
            0.08,
          )
        : 8;
      s.pos.lerp(s.targetPos, 1 - Math.exp(-posRate * dt));
      s.quat.slerp(s.targetQuat, 1 - Math.exp(-rotRate * dt));
    }

    const squash = 1 - 0.06 * s.grab;
    const side = gloveSideSign(handedness);
    root.quaternion.copy(s.quat);
    // Sit the palm behind the handle so the fingers wrap it, not the wrist.
    const hug = blend * 0.11;
    s.aim.set(0, 0.05 * hug, 0.09 * hug).applyQuaternion(s.quat);
    root.position.copy(s.pos).sub(s.aim);
    root.scale.set(side * 1.22 * squash, 1.22 * squash, 1.22 * squash);

    for (let i = 0; i < FINGERS.length; i++) {
      const finger = fingerRefs.current[i];
      if (!finger) continue;
      const spec = FINGERS[i];
      const mid = midRefs.current[i];
      const tip = tipRefs.current[i];
      const pose = poseGloveFinger(
        spec,
        gloveCurl(s.folds[i] ?? 0),
        s.oppose,
        s.squeeze,
      );
      finger.position.set(pose.position[0], pose.position[1], pose.position[2]);
      finger.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
      if (mid) mid.rotation.set(pose.mid[0], pose.mid[1], pose.mid[2]);
      if (tip) tip.rotation.set(pose.tip[0], pose.tip[1], pose.tip[2]);
    }

    s.lightDir.copy(frameState.camera.position).sub(s.pos);
    if (s.lightDir.lengthSq() < 1e-8) s.lightDir.set(0.25, -0.35, 0.9);
    else s.lightDir.normalize();
    s.gloveTint.copy(GLOVE_RESTING).lerp(GLOVE_COLOR, fade);
    s.gloveTint.lerp(GRAB_COLOR, s.grab * 0.45);
    s.cuffTint.copy(s.accent).lerp(GRAB_COLOR, s.grab);
    paintHandToon(materials.glove, s.gloveTint, GRAB_COLOR, 0.16 * s.grab, s.lightDir, fade);
    paintHandToon(materials.cuff, s.cuffTint, GRAB_COLOR, 0.1 * s.grab, s.lightDir, fade);
  });

  return (
    <group ref={rootRef} visible={false}>
      <RoundedBox
        ref={palmRef}
        args={[0.42, 0.38, 0.14]}
        radius={0.12}
        smoothness={3}
        position={[0, 0.02, 0]}
        material={materials.glove}
        castShadow
      />
      {FINGERS.map((finger, index) => (
        <group
          key={finger.name}
          ref={(node) => {
            fingerRefs.current[index] = node;
          }}
          position={[finger.x, finger.y, finger.z]}
          rotation={finger.thumb ? [0.22, 0, finger.spread] : [0.06, 0, finger.spread]}
        >
          <mesh
            position={[0, finger.length * 0.22, 0]}
            material={materials.glove}
            castShadow
          >
            <capsuleGeometry args={[finger.thick, finger.length * 0.28, 6, 10]} />
          </mesh>
          <group
            ref={(node) => {
              midRefs.current[index] = node;
            }}
            position={[0, finger.length * 0.42, 0]}
          >
            <mesh
              position={[0, finger.length * 0.14, 0]}
              material={materials.glove}
              castShadow
            >
              <capsuleGeometry
                args={[finger.thick * 0.94, finger.length * 0.16, 6, 10]}
              />
            </mesh>
            <group
              ref={(node) => {
                tipRefs.current[index] = node;
              }}
              position={[0, finger.length * 0.28, 0]}
            >
              <mesh
                position={[0, finger.length * 0.12, 0]}
                material={materials.glove}
                castShadow
              >
                <capsuleGeometry
                  args={[finger.thick * 0.88, finger.length * 0.12, 6, 10]}
                />
              </mesh>
              <mesh
                position={[0, finger.length * 0.24, 0]}
                material={materials.glove}
                castShadow
              >
                <sphereGeometry args={[finger.thick * 0.92, 10, 8]} />
              </mesh>
            </group>
          </group>
        </group>
      ))}
      <RoundedBox
        ref={cuffRef}
        args={[0.36, 0.16, 0.14]}
        radius={0.07}
        smoothness={3}
        position={[0, -0.2, 0]}
        material={materials.cuff}
        castShadow
      />
    </group>
  );
}

export function HandGloves({
  handsRef,
  holdRef,
  active = true,
}: {
  handsRef: RefObject<TrackedHand[]>;
  holdRef?: RefObject<GloveHold>;
  active?: boolean;
}) {
  return (
    <>
      <RobotHand
        handedness="Left"
        handsRef={handsRef}
        holdRef={holdRef}
        active={active}
      />
      <RobotHand
        handedness="Right"
        handsRef={handsRef}
        holdRef={holdRef}
        active={active}
      />
    </>
  );
}
