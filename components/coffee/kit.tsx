"use client";

import { useMemo, type RefObject } from "react";
import { useGLTF } from "@react-three/drei";
import type { Group, Material, Mesh } from "three";
import {
  Box3,
  Color,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Vessel } from "./liquid";
import type { PropKind } from "./recipes";
import type { Solid } from "./solid";
import { Beans } from "./effects";
import { CARGO, type CargoSpec } from "./cargo";
import { mouthOf } from "./mouth";

/**
 * The coffee bar, assembled from Kenney's CC0 kits rather than modelled here.
 * See `public/models/kit/CREDITS.md` for what came from where.
 *
 * A kit is drawn to its own sense of scale and its own idea of which way is up,
 * and no two kits agree. Rather than hand-tuning a scale per piece and watching
 * them all drift apart, every model is measured when it loads and fitted to the
 * span its role calls for. Swapping a model then means changing one filename.
 */

type KitEntry = {
  file: string;
  /** Which folder under `public/models` it lives in. */
  dir?: string;
  /**
   * How big the piece ends up, measured along whichever of its three dimensions
   * is longest. Fitting by width alone would make a tall narrow glass tower
   * over everything and a flat saucer disappear.
   */
  size: number;
  /** Turn about the table's up axis, for pieces modelled facing elsewhere. */
  yaw?: number;
  /** Tilt toward the table, so a mallet can press instead of standing upright. */
  pitch?: number;
  /** Lift off the tabletop, for pieces meant to hover rather than rest. */
  lift?: number;
  /** Push away from the camera, for tall pieces that would block the target. */
  back?: number;
  /** Extras the kit bundles in that this scene does not want. */
  hide?: string[];
  /**
   * Whether it takes part in shadowing. Only the handful of pieces on the
   * counter need to: shadow-casting every plant and stool in the room costs
   * real frames and buys nothing at this distance.
   */
  shadows?: boolean;
  /**
   * Loose contents (beans, grounds) that sit inside the bowl — not at the
   * group's origin. Offset is in the yaw group's local frame (game units),
   * the same space as the fitted mesh, so yaw turns both together. For a
   * spatula, `seat: "wide-end"` measures the blade instead of guessing a sign.
   */
  cargo?: CargoSpec;
};

/**
 * A piece the player can touch. Scenery only needs to be drawn, so it uses
 * `KitEntry` alone; anything on the counter also has to be stood on, bumped
 * into and picked up, and that is what the rest of this adds.
 */
export type PropEntry = KitEntry & {
  /**
   * The space it takes up and what it weighs. Written per object from the
   * fitted model rather than wrapping everything in one generous box: that
   * oversized box was why a spoon could not be set down beside a cup.
   */
  solid: Solid;
  /** The inside, when it is something that can hold liquid. */
  vessel?: Vessel;
};

const url = (entry: { file: string; dir?: string }) =>
  `/models/${entry.dir ?? "kit"}/${entry.file}`;

export const KIT: Record<PropKind, PropEntry | null> = {
  // Two cups, because one has to be able to fill up: the served one comes with
  // its coffee modelled in, the empty one is what the liquid rises inside.
  cup: {
    file: "cup-coffee.glb",
    size: 1.2,
    yaw: -0.35,
    solid: { shape: { kind: "round", radius: 0.42, height: 0.5 }, mass: 1.6, friction: 0.6 },
    vessel: { radius: 0.32, floor: 0.1, depth: 0.32 },
  },
  mug: {
    file: "cup.glb",
    size: 1.25,
    yaw: -0.35,
    solid: { shape: { kind: "round", radius: 0.44, height: 0.56 }, mass: 1.5, friction: 0.6 },
    vessel: { radius: 0.34, floor: 0.1, depth: 0.4 },
  },
  saucer: {
    file: "cup-saucer.glb",
    size: 1.9,
    // Open, so a cup set down on it drops into the well instead of hovering
    // over the rim.
    solid: { shape: { kind: "open", radius: 0.92, height: 0.18, rim: 0.7, floor: 0.07 }, mass: 1.2, friction: 0.7 },
  },
  // A mortar and its pestle: grinding by turning in circles is exactly what the
  // stage already asks the hand to do, so the tool finally matches the gesture.
  grinder: {
    file: "mortar.glb",
    size: 2.7,
    solid: { shape: { kind: "open", radius: 1.2, height: 0.92, rim: 0.95, floor: 0.2 }, mass: 5, friction: 0.9 },
  },
  crank: {
    file: "mortar-pestle.glb",
    size: 1.15,
    yaw: 0.4,
    solid: { shape: { kind: "round", radius: 0.17, height: 1.1 }, mass: 1.1, friction: 0.5 },
  },
  scoop: {
    file: "cooking-spoon.glb",
    size: 1.6,
    yaw: Math.PI,
    solid: { shape: { kind: "slab", halfLong: 0.8, halfShort: 0.21, height: 0.1 }, mass: 0.6, friction: 0.4 },
    cargo: CARGO.scoop,
  },
  kettle: {
    file: "pot.glb",
    size: 1.9,
    yaw: -0.5,
    solid: { shape: { kind: "round", radius: 0.74, height: 0.84 }, mass: 3.4, friction: 0.7 },
    vessel: { radius: 0.5, floor: 0.12, depth: 0.5 },
  },
  jug: {
    file: "carton.glb",
    size: 1.15,
    solid: { shape: { kind: "round", radius: 0.23, height: 1.1 }, mass: 1.9, friction: 0.5 },
    vessel: { radius: 0.19, floor: 0.08, depth: 0.86 },
  },
  filter: {
    file: "bowl.glb",
    size: 1.6,
    solid: { shape: { kind: "open", radius: 0.68, height: 0.56, rim: 0.52, floor: 0.12 }, mass: 0.7, friction: 0.5 },
    cargo: CARGO.filter,
  },
  brewer: {
    file: "glass.glb",
    size: 1.5,
    solid: { shape: { kind: "round", radius: 0.41, height: 1.46 }, mass: 1.5, friction: 0.6 },
    vessel: { radius: 0.31, floor: 0.09, depth: 1.18 },
  },
  portafilter: {
    file: "frying-pan.glb",
    size: 2.3,
    yaw: Math.PI * 0.5,
    solid: { shape: { kind: "slab", halfLong: 1.15, halfShort: 0.62, height: 0.27 }, mass: 2.6, friction: 0.6 },
    cargo: CARGO.portafilter,
  },
  tamper: {
    file: "meat-tenderizer.glb",
    size: 1.35,
    yaw: Math.PI * 0.5,
    pitch: 1.15,
    solid: { shape: { kind: "slab", halfLong: 0.7, halfShort: 0.28, height: 0.22 }, mass: 2.2, friction: 0.5 },
  },
  // The machine ships with a mug already under its spout; the game puts its own
  // cup there, so the bundled one goes. Set back so its body does not stand in
  // front of the ring the player is aiming at.
  machine: {
    file: "kitchen-coffee-machine.glb",
    size: 2.3,
    yaw: Math.PI,
    back: 1.15,
    hide: ["mug"],
    solid: { shape: { kind: "round", radius: 1.0, height: 2.1 }, mass: 14, friction: 1 },
  },
  // The mat is a circle painted on the tabletop, not an object.
  mat: null,
};

/** Extra pieces the game dresses scenes with, outside the stage vocabulary. */
export const EXTRAS = {
  foam: { file: "whipped-cream.glb", size: 1.0 },
} as const;

const ALL_FILES = [
  ...Object.values(KIT).flatMap((entry) => (entry ? [entry.file] : [])),
  ...Object.values(EXTRAS).map((entry) => entry.file),
];

for (const file of ALL_FILES) useGLTF.preload(url({ file }));

/**
 * Kit materials are flat by design — no metalness, roughness pinned at 1 — which
 * reads as plastic under the scene's lighting. Waking them up once per loaded
 * file gives the ceramics a sheen and the metals something to reflect, without
 * touching the geometry the artist shipped.
 */
const TUNED = new WeakSet<object>();

/**
 * Scenery gets collapsed onto one shared flat material per colour.
 *
 * Kenney's furniture carries a handful of named materials per file, and twenty
 * files of it is eighty distinct physical materials — each one a separate
 * shader, compiled against every light in the room and the environment map.
 * That compile storm was enough to lose the WebGL context outright on the first
 * frame. Nothing three metres behind the counter needs metalness or a
 * reflection, so the whole room ends up sharing a couple of cheap Lambert
 * materials and the renderer stops falling over.
 */
const FLAT = new Map<string, MeshLambertMaterial>();

/**
 * Furniture kits are drawn in showroom colours — bright whites and cool greys —
 * and a room built from them straight out of the box looks like a showroom.
 * Pulling every colour a quarter of the way toward warm oak, and taking a
 * little light out of it, is what turns the same models into a café without
 * repainting a single file.
 */
const WARMTH = new Color("#8f1824");
const WARM_MIX = 0.42;

function flatten(material: Material): Material {
  const source = material as MeshStandardMaterial;
  const tint = source.color ? source.color.getHexString() : "ffffff";
  // Keyed by texture as well as colour: the food pieces carry all of their
  // colour in one shared atlas, and collapsing them onto colour alone turned
  // every cake and cup on the back counter into a white blob.
  const key = `${tint}/${source.map ? source.map.uuid : "none"}`;

  let flat = FLAT.get(key);
  if (!flat) {
    const tinted = new Color(`#${tint}`).lerp(WARMTH, WARM_MIX);
    tinted.multiplyScalar(0.92);
    flat = new MeshLambertMaterial({ color: tinted, map: source.map ?? null });
    FLAT.set(key, flat);
  }
  return flat;
}

function tune(root: Group, shadows: boolean) {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;

    if (!shadows) {
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(flatten)
        : flatten(mesh.material);
      return;
    }

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      if (TUNED.has(material)) continue;
      TUNED.add(material);
      const metallic = /metal|steel|chrome/i.test(material.name);
      material.metalness = metallic ? 0.75 : 0.06;
      material.roughness = metallic ? 0.32 : 0.55;
      material.envMapIntensity = metallic ? 1.35 : 0.85;
    }
  });
}

/**
 * One kit piece, measured and fitted. Everything inside sits on the tabletop,
 * centred on the group's origin, so callers only ever position the group.
 *
 * The measuring happens while the clone is still detached from the scene. A
 * `Box3` built from a mounted object is in world space, so it carries whatever
 * its ancestors have done to it — measure it after mounting and a piece placed
 * at x = 1.85 gets centred by 1.85 again, which threw the mortar clean off the
 * table. Measuring it alone gives numbers in the model's own units, and every
 * transform after that is ordinary JSX.
 */
export function KitModel({
  file,
  dir,
  size: target,
  yaw = 0,
  pitch = 0,
  lift = 0,
  back = 0,
  hide,
  shadows = true,
  cargo,
  showCargo = true,
  shake,
}: KitEntry & { showCargo?: boolean; shake?: RefObject<number> }) {
  const { scene } = useGLTF(url({ file, dir }));

  // One clone per instance: the same cup shows up in several stages, and they
  // must not share a transform.
  const fitted = useMemo(() => {
    const model = cloneSkinned(scene) as Group;
    // Kits are authored Y-up; this table's up is Z.
    model.rotation.set(Math.PI / 2, 0, 0);
    tune(model, shadows);

    if (hide) {
      for (const name of hide) {
        const part = model.getObjectByName(name);
        if (part) part.visible = false;
      }
    }

    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    // Fitting by the longest dimension rather than the width keeps a tall
    // narrow glass from towering and a flat saucer from vanishing.
    const longest = Math.max(size.x, size.y, size.z);

    // A model that measures nothing — no geometry, or geometry the loader could
    // not read — would otherwise divide by almost zero and be scaled into a
    // wall of triangles across the whole frustum, which takes the renderer down
    // rather than looking wrong. Better to draw it at its own size and say so.
    const usable = Number.isFinite(longest) && longest > 1e-3;
    if (!usable) {
      console.warn(`[kit] ${file} has no measurable geometry; left unscaled`);
    }

    const scale = usable ? target / longest : 1;
    const offset = [-centre.x, -centre.y, -box.min.z] as const;

    let mouth: [number, number, number] = [offset[0] * scale, offset[1] * scale, 0.1];
    if (cargo?.seat === "wide-end") {
      // Game-unit verts in the yaw group's local frame (scale on, yaw off).
      // Cargo is a sibling of the scale group, so this is where a heap must sit.
      const verts: { x: number; y: number; z: number }[] = [];
      const vertex = new Vector3();
      model.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
        const attr = mesh.geometry.attributes.position;
        for (let i = 0; i < attr.count; i++) {
          vertex.fromBufferAttribute(attr, i);
          mesh.localToWorld(vertex);
          verts.push({
            x: (vertex.x + offset[0]) * scale,
            y: (vertex.y + offset[1]) * scale,
            z: (vertex.z + offset[2]) * scale,
          });
        }
      });
      mouth = mouthOf(verts, 0.08);
    }

    return {
      model,
      scale,
      // In model units, because the scale is applied by the group above these.
      offset,
      mouth,
    };
  }, [scene, file, target, hide, shadows, cargo?.seat]);

  // Cargo rides the yaw so it stays in the bowl when the piece is turned.
  // It stays outside the fit-scale group so offsets are in game units.
  return (
    <group position={[0, back, lift]} rotation={[pitch, 0, yaw]}>
      <group scale={fitted.scale}>
        <group position={fitted.offset as unknown as [number, number, number]}>
          <primitive object={fitted.model} />
        </group>
      </group>
      {cargo && showCargo && (
        <Beans
          key={(cargo.seat === "wide-end" ? fitted.mouth : cargo.offset).join(",")}
          position={cargo.seat === "wide-end" ? fitted.mouth : cargo.offset}
          radius={cargo.radius}
          count={cargo.count ?? 12}
          colour={cargo.colour}
          grain={cargo.grain}
          heap
          shake={shake}
        />
      )}
    </group>
  );
}

/**
 * Every role that has a real model behind it, in a stable order.
 *
 * Lives here rather than in the lab that shows it, because the lab and its 3D
 * scene both need it and having one import the other made a cycle — which in
 * development resolved to undefined and left the turntable empty.
 */
export const PIECES = Object.entries(KIT)
  .filter((pair): pair is [PropKind, PropEntry] => pair[1] !== null)
  .map(([kind, entry]) => ({ kind, entry }))
  .sort((a, b) => a.kind.localeCompare(b.kind));

/** The piece a stage names, or nothing when that role has no model. */
export function KitPiece({
  kind,
  showCargo = true,
  shake,
}: {
  kind: PropKind;
  showCargo?: boolean;
  shake?: RefObject<number>;
}) {
  const entry = KIT[kind];
  if (!entry) return null;
  return (
    <>
      <KitModel {...entry} showCargo={showCargo} shake={shake} />
      <RoleDetails
        kind={kind}
        yaw={entry.yaw ?? 0}
        back={entry.back ?? 0}
        lift={entry.lift ?? 0}
      />
    </>
  );
}

/**
 * Small semantic details over the CC0 base meshes. They make reused kitchen
 * kit pieces read as their gameplay role (spout, group head, dripper collar)
 * without replacing the measured/collision-tested body underneath.
 */
function RoleDetails({
  kind,
  yaw,
  back,
  lift,
}: {
  kind: PropKind;
  yaw: number;
  back: number;
  lift: number;
}) {
  const metal = (
    <meshStandardMaterial color="#b9aaa0" metalness={0.72} roughness={0.28} />
  );
  const brass = (
    <meshStandardMaterial color="#c88932" metalness={0.68} roughness={0.3} />
  );

  return (
    <group position={[0, back, lift]} rotation={[0, 0, yaw]}>
      {kind === "kettle" && (
        <>
          <mesh
            position={[0.67, 0, 0.48]}
            rotation={[Math.PI / 2, 0, -Math.PI / 2]}
            castShadow
          >
            <coneGeometry args={[0.17, 0.78, 20]} />
            {metal}
          </mesh>
          <mesh
            position={[-0.08, 0.05, 0.69]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[0.54, 0.07, 12, 36, Math.PI]} />
            <meshStandardMaterial
              color="#4a281b"
              roughness={0.68}
              metalness={0.08}
            />
          </mesh>
          <mesh position={[0, 0, 0.83]} castShadow>
            <cylinderGeometry args={[0.1, 0.14, 0.13, 20]} />
            {brass}
          </mesh>
        </>
      )}

      {kind === "brewer" && (
        <>
          <mesh position={[0, 0, 0.9]} castShadow>
            <cylinderGeometry args={[0.44, 0.34, 0.16, 32]} />
            <meshStandardMaterial
              color="#6c4330"
              roughness={0.48}
              metalness={0.08}
            />
          </mesh>
          <mesh position={[0, 0, 1.06]} castShadow>
            <coneGeometry args={[0.47, 0.34, 32, 1, true]} />
            <meshStandardMaterial
              color="#b66b38"
              roughness={0.58}
              side={2}
            />
          </mesh>
          {/* Paper filter seated in the cone — this is the "filtro", not a pan. */}
          <mesh position={[0, 0, 1.04]}>
            <coneGeometry args={[0.38, 0.3, 28, 1, true]} />
            <meshStandardMaterial
              color="#f3e2c4"
              roughness={0.86}
              side={2}
            />
          </mesh>
        </>
      )}

      {kind === "machine" && (
        <>
          {/* Group heads on the camera side of the machine (yaw π). */}
          {[0.22, -0.22].map((x) => (
            <mesh
              key={x}
              position={[x, 1.33, 1.16]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.08, 0.08, 0.06, 18]} />
              {x > 0 ? brass : metal}
            </mesh>
          ))}
          <mesh position={[0, 1.38, 0.78]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.32, 16]} />
            {metal}
          </mesh>
        </>
      )}

      {kind === "filter" && (
        <mesh position={[0, 0, 0.42]}>
          <torusGeometry args={[0.53, 0.035, 10, 36]} />
          <meshStandardMaterial color="#d8c3a5" roughness={0.76} />
        </mesh>
      )}
    </group>
  );
}
