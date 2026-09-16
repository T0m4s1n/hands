"use client";

import { useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Grid, RoundedBox } from "@react-three/drei";
import type { Mesh, MeshStandardMaterial } from "three";
import { Color, PCFShadowMap, Vector3 } from "three";
import type { Handedness, TrackedHand } from "@/hooks/useHandTracking";

const GRAB_RADIUS = 0.95;
const FLOOR_Y = -1.35;
const GRAVITY = 9.2;

type SceneObject = {
  id: string;
  color: string;
  mesh: Mesh | null;
  grabbedBy: Handedness | null;
  velocityY: number;
  hasBeenGrabbed: boolean;
};

const INITIAL_OBJECTS: { id: string; color: string; position: [number, number, number] }[] =
  [
    { id: "cube-red", color: "#f43f5e", position: [-1.6, 0.15, 0] },
    { id: "cube-cyan", color: "#22d3ee", position: [0, 0.45, 0.1] },
    { id: "cube-amber", color: "#fbbf24", position: [1.55, 0.05, -0.05] },
  ];

function paintObject(object: SceneObject, restY: number, dt: number) {
  const mesh = object.mesh;
  if (!mesh) return;
  const material = mesh.material as MeshStandardMaterial;
  if (object.grabbedBy) {
    material.emissive.set(object.color);
    material.emissiveIntensity = 0.35;
    mesh.scale.setScalar(1.08);
    return;
  }
  material.emissive.set("#000000");
  material.emissiveIntensity = 0;
  mesh.scale.setScalar(1);

  if (object.hasBeenGrabbed && mesh.position.y > restY + 0.001) {
    object.velocityY -= GRAVITY * dt;
    mesh.position.y += object.velocityY * dt;
    if (mesh.position.y <= restY) {
      mesh.position.y = restY;
      object.velocityY = 0;
    }
  }
}

function grabDistance(cursor: TrackedHand["cursor"], object: Vector3): number {
  const dx = cursor.x - object.x;
  const dy = cursor.y - object.y;
  const dz = (cursor.z - object.z) * 0.35;
  return Math.hypot(dx, dy, dz);
}

function HandCursors({
  handsRef,
}: {
  handsRef: RefObject<TrackedHand[]>;
}) {
  const leftRef = useRef<Mesh>(null);
  const rightRef = useRef<Mesh>(null);
  const leftRing = useRef<Mesh>(null);
  const rightRing = useRef<Mesh>(null);
  const grabColor = useMemo(() => new Color("#4ade80"), []);
  const idleLeft = useMemo(() => new Color("#38bdf8"), []);
  const idleRight = useMemo(() => new Color("#c084fc"), []);

  useFrame(() => {
    const configs: {
      handedness: Handedness;
      cursor: RefObject<Mesh | null>;
      ring: RefObject<Mesh | null>;
      idle: Color;
    }[] = [
      { handedness: "Left", cursor: leftRef, ring: leftRing, idle: idleLeft },
      { handedness: "Right", cursor: rightRef, ring: rightRing, idle: idleRight },
    ];

    for (const { handedness, cursor, ring, idle } of configs) {
      const hand = (handsRef.current ?? []).find(
        (item) => item.handedness === handedness,
      );
      const mesh = cursor.current;
      const ringMesh = ring.current;
      if (!mesh || !ringMesh) continue;

      if (!hand) {
        mesh.visible = false;
        ringMesh.visible = false;
        continue;
      }

      mesh.visible = true;
      ringMesh.visible = true;
      mesh.position.set(hand.cursor.x, hand.cursor.y, hand.cursor.z);
      ringMesh.position.copy(mesh.position);
      const pinchScale = 0.35 + Math.min(hand.pinchDistance, 1.2) * 0.55;
      ringMesh.scale.setScalar(pinchScale);

      const material = mesh.material as MeshStandardMaterial;
      const ringMaterial = ringMesh.material as MeshStandardMaterial;
      const color = hand.isGrabbing ? grabColor : idle;
      material.color.copy(color);
      material.emissive.copy(color);
      ringMaterial.color.copy(color);
      ringMaterial.emissive.copy(color);
    }
  });

  return (
    <>
      <mesh ref={leftRef} visible={false}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial emissiveIntensity={0.7} roughness={0.25} />
      </mesh>
      <mesh ref={leftRing} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.018, 8, 24]} />
        <meshStandardMaterial emissiveIntensity={0.45} roughness={0.3} />
      </mesh>
      <mesh ref={rightRef} visible={false}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial emissiveIntensity={0.7} roughness={0.25} />
      </mesh>
      <mesh ref={rightRing} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.018, 8, 24]} />
        <meshStandardMaterial emissiveIntensity={0.45} roughness={0.3} />
      </mesh>
    </>
  );
}

function GrabbableCube({
  id,
  color,
  position,
  registry,
}: {
  id: string;
  color: string;
  position: [number, number, number];
  registry: MutableRefObject<SceneObject[]>;
}) {
  const localRef = useRef<Mesh>(null);

  return (
    <RoundedBox
      ref={(mesh) => {
        localRef.current = mesh;
        const existing = registry.current.find((item) => item.id === id);
        if (existing) {
          existing.mesh = mesh;
          return;
        }
        if (mesh) {
          registry.current.push({
            id,
            color,
            mesh,
            grabbedBy: null,
            velocityY: 0,
            hasBeenGrabbed: false,
          });
        }
      }}
      args={[0.58, 0.58, 0.58]}
      radius={0.08}
      smoothness={4}
      position={position}
      castShadow
    >
      <meshStandardMaterial color={color} roughness={0.28} metalness={0.18} />
    </RoundedBox>
  );
}

function GrabController({
  handsRef,
  objectsRef,
}: {
  handsRef: RefObject<TrackedHand[]>;
  objectsRef: MutableRefObject<SceneObject[]>;
}) {
  const wasGrabbing = useRef<Record<Handedness, boolean>>({
    Left: false,
    Right: false,
  });
  const target = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const objects = objectsRef.current;
    const hands = handsRef.current ?? [];

    (["Left", "Right"] as const).forEach((handedness) => {
      const hand = hands.find((item) => item.handedness === handedness);
      const grabbing = Boolean(hand?.isGrabbing);
      const held = objects.find((object) => object.grabbedBy === handedness);
      const risingEdge = grabbing && !wasGrabbing.current[handedness];

      if (risingEdge && hand && !held) {
        let nearest: SceneObject | null = null;
        let nearestDist = GRAB_RADIUS;
        for (const object of objects) {
          if (object.grabbedBy || !object.mesh) continue;
          const d = grabDistance(hand.cursor, object.mesh.position);
          if (d < nearestDist) {
            nearest = object;
            nearestDist = d;
          }
        }
        if (nearest) {
          nearest.grabbedBy = handedness;
          nearest.hasBeenGrabbed = true;
          nearest.velocityY = 0;
        }
      }

      if (!grabbing && held) {
        held.grabbedBy = null;
      }

      if (grabbing && hand) {
        const attached = objects.find((object) => object.grabbedBy === handedness);
        if (attached?.mesh) {
          target.set(hand.cursor.x, hand.cursor.y, hand.cursor.z);
          const follow = 1 - Math.pow(0.0004, dt);
          attached.mesh.position.lerp(target, follow);
          attached.velocityY = 0;
        }
      }

      wasGrabbing.current[handedness] = grabbing;
    });

    const half = 0.29;
    const restY = FLOOR_Y + half;
    for (const object of objects) {
      paintObject(object, restY, dt);
    }
  });

  return null;
}

function SceneContents({
  handsRef,
}: {
  handsRef: RefObject<TrackedHand[]>;
}) {
  const objectsRef = useRef<SceneObject[]>([]);

  return (
    <>
      <color attach="background" args={["#070b14"]} />
      <hemisphereLight args={["#dbeafe", "#0f172a", 0.85]} />
      <directionalLight
        position={[4.5, 7, 6]}
        intensity={1.35}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <ambientLight intensity={0.28} />

      <Grid
        position={[0, FLOOR_Y, 0]}
        args={[16, 16]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#1e293b"
        sectionSize={2}
        sectionThickness={1.1}
        sectionColor="#334155"
        fadeDistance={18}
        fadeStrength={1.4}
        infiniteGrid
      />
      <ContactShadows
        position={[0, FLOOR_Y + 0.01, 0]}
        opacity={0.45}
        scale={12}
        blur={2.2}
        far={4}
      />

      {INITIAL_OBJECTS.map((object) => (
        <GrabbableCube
          key={object.id}
          id={object.id}
          color={object.color}
          position={object.position}
          registry={objectsRef}
        />
      ))}

      <HandCursors handsRef={handsRef} />
      <GrabController handsRef={handsRef} objectsRef={objectsRef} />
    </>
  );
}

export function HandTrackedScene({
  handsRef,
}: {
  handsRef: RefObject<TrackedHand[]>;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.35, 6.2], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = PCFShadowMap;
      }}
    >
      <SceneContents handsRef={handsRef} />
    </Canvas>
  );
}
