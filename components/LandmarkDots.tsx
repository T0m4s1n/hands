"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { InstancedMesh } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  HAND_CONNECTIONS,
  landmarkToWorld,
  type TrackedHand,
} from "@/hooks/useHandTracking";
import { lockSpan } from "@/hooks/palmFrame";

const JOINTS = 21;
const MAX_HANDS = 2;
const DOTS = JOINTS * MAX_HANDS;
const BARS = HAND_CONNECTIONS.length * MAX_HANDS;
const AXIS_Y = new Vector3(0, 1, 0);
/** Somewhere off camera to park instances that have no landmark this frame. */
const PARKED = new Vector3(0, 0, -999);

function createScratch() {
  return {
    matrix: new Matrix4(),
    from: new Vector3(),
    to: new Vector3(),
    mid: new Vector3(),
    dir: new Vector3(),
    unit: new Vector3(1, 1, 1),
    size: new Vector3(),
    quat: new Quaternion(),
    idle: new Quaternion(),
    wrist: new Vector3(),
    world: Array.from({ length: JOINTS }, () => new Vector3()),
  };
}

/**
 * The tracked landmarks, drawn over the posed model so a disagreement between
 * the two can be read off directly: if the dots are in the right places and
 * the glove is not, the problem is the retargeting rather than the tracking.
 *
 * They are drawn at the glove's locked span rather than at their own apparent
 * size. That is the one piece of retargeting done here, and without it this
 * view could not do its job: a hand near the camera reports a cloud far larger
 * than the fixed-size glove, so the two never line up and every disagreement
 * looks enormous whether or not anything is wrong.
 */
export function LandmarkDots({
  handsRef,
  visible,
}: {
  handsRef: RefObject<TrackedHand[]>;
  visible: boolean;
}) {
  const dotsRef = useRef<InstancedMesh>(null);
  const barsRef = useRef<InstancedMesh>(null);
  const scratchRef = useRef<ReturnType<typeof createScratch> | null>(null);

  useFrame(() => {
    const dots = dotsRef.current;
    const bars = barsRef.current;
    if (!dots || !bars) return;
    dots.visible = visible;
    bars.visible = visible;
    if (!visible) return;

    const s = (scratchRef.current ??= createScratch());
    const hands = (handsRef.current ?? [])
      .filter((hand) => hand.smoothedLandmarks.length === JOINTS)
      .slice(0, MAX_HANDS);

    let dot = 0;
    let bar = 0;
    for (const hand of hands) {
      for (let i = 0; i < JOINTS; i++) {
        const point = landmarkToWorld(hand.smoothedLandmarks[i]);
        s.world[i].set(point.x, point.y, point.z);
      }
      // The same rescaling the glove does, so the two are comparable.
      lockSpan(s.world, s.wrist);
      for (let i = 0; i < JOINTS; i++) {
        s.matrix.compose(s.world[i], s.idle, s.unit);
        dots.setMatrixAt(dot++, s.matrix);
      }

      for (const [a, b] of HAND_CONNECTIONS) {
        s.from.copy(s.world[a]);
        s.to.copy(s.world[b]);
        s.mid.copy(s.from).add(s.to).multiplyScalar(0.5);
        s.dir.copy(s.to).sub(s.from);
        const length = Math.max(s.dir.length(), 1e-4);
        s.dir.divideScalar(length);
        s.quat.setFromUnitVectors(AXIS_Y, s.dir);
        s.matrix.compose(s.mid, s.quat, s.size.set(1, length, 1));
        bars.setMatrixAt(bar++, s.matrix);
      }
    }

    s.matrix.compose(PARKED, s.idle, s.unit);
    for (; dot < DOTS; dot++) dots.setMatrixAt(dot, s.matrix);
    for (; bar < BARS; bar++) bars.setMatrixAt(bar, s.matrix);

    dots.instanceMatrix.needsUpdate = true;
    bars.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={dotsRef}
        args={[undefined, undefined, DOTS]}
        visible={false}
        frustumCulled={false}
        renderOrder={2}
      >
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshBasicMaterial color="#4ade80" depthTest={false} />
      </instancedMesh>
      <instancedMesh
        ref={barsRef}
        args={[undefined, undefined, BARS]}
        visible={false}
        frustumCulled={false}
        renderOrder={1}
      >
        <cylinderGeometry args={[0.022, 0.022, 1, 6]} />
        <meshBasicMaterial color="#22d3ee" depthTest={false} />
      </instancedMesh>
    </>
  );
}
