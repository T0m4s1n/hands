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
    world: Array.from({ length: JOINTS }, () => new Vector3()),
  };
}

/**
 * The raw tracked landmarks, drawn straight from the data with no retargeting
 * in between. Laid over the posed model, this is what tells you whether a
 * disagreement comes from the tracking or from the way the model follows it.
 * Sized to read clearly against the glove so the skeleton is the focus.
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
