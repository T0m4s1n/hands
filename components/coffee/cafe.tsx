"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from "three";
import { buildSeats, Crowd } from "./crowd";
import { KitModel } from "./kit";

/**
 * The room the counter stands in: a stage with an audience behind it.
 *
 * The counter is where the game happens, and everything else exists to make
 * that spot feel like somewhere worth standing. A raked crowd does that better
 * than a back wall of furniture did — it gives the camera a reason to be where
 * it is, it fills the frame with something that moves, and it gives the player
 * somebody to be doing this in front of.
 *
 * None of it is interactive, so none of it casts shadows or is measured for
 * collision. All of it is Kenney's CC0 kits; see the credits beside the models.
 */

/** Where the floor sits, taking the counter for bar height. */
export const FLOOR_Z = -3.1;
/** How far back the wall behind the seating stands. */
const WALL_Y = 30.0;
/** Where the first row of the audience begins. */
const FRONT_Y = 10.4;
/** How far back each row sits, and how much higher. */
const ROW_DEPTH = 2.9;
const ROW_RISE = 1.25;
const ROWS = 6;
const PER_ROW = 21;
/**
 * Close enough that neighbours overlap. Spaced out, the same figures read as a
 * line of separate posts; overlapping, they read as one mass of people, which
 * is the whole difference between a crowd and a row.
 */
const SPACING = 1.8;
/** How wide the risers and the backdrop run. */
const HALL = 23;

const ROOM = "cafe";

type Placed = {
  file: string;
  size: number;
  at: readonly [number, number, number];
  yaw?: number;
};

/** Décor never casts shadows and never needs to be looked up by name. */
function Decor({ file, size, at, yaw = 0 }: Placed) {
  return (
    <group position={[at[0], at[1], at[2]]}>
      <KitModel file={file} dir={ROOM} size={size} yaw={yaw} shadows={false} />
    </group>
  );
}

/**
 * What is left of the café, pushed out to the wings so the middle of the frame
 * belongs to the crowd. A few plants and shelves at the edges are enough to say
 * the stage is in a coffee bar rather than a sports hall.
 */
const WINGS: readonly Placed[] = [
  { file: "bookcaseOpen.glb", size: 5.6, at: [-15.5, 2.0, FLOOR_Z], yaw: 1.5 },
  { file: "bookcaseClosedDoors.glb", size: 4.4, at: [15.8, 2.4, FLOOR_Z], yaw: -1.5 },
  { file: "pottedPlant.glb", size: 3.2, at: [-12.4, 1.2, FLOOR_Z] },
  { file: "pottedPlant.glb", size: 2.8, at: [12.6, 1.4, FLOOR_Z], yaw: 0.6 },
  { file: "plantSmall2.glb", size: 1.6, at: [-14.2, 4.6, FLOOR_Z] },
  { file: "plantSmall3.glb", size: 1.5, at: [14.4, 4.8, FLOOR_Z], yaw: 1.1 },
  { file: "coatRackStanding.glb", size: 3.6, at: [-17.6, 4.4, FLOOR_Z], yaw: 0.4 },
  { file: "barrel.glb", size: 2.4, at: [-13.0, 5.4, FLOOR_Z], yaw: 0.4 },
  { file: "cardboardBoxClosed.glb", size: 1.9, at: [13.2, 5.6, FLOOR_Z], yaw: -0.5 },
  { file: "trashcan.glb", size: 1.6, at: [16.8, 5.2, FLOOR_Z] },
  { file: "lampSquareFloor.glb", size: 4.2, at: [-18.6, 1.0, FLOOR_Z], yaw: -0.5 },
  // Two stools left at the ends of the bar, where they catch the frame edge.
  { file: "stoolBar.glb", size: 2.6, at: [-8.6, -6.2, FLOOR_Z] },
  { file: "stoolBar.glb", size: 2.6, at: [8.6, -6.2, FLOOR_Z] },
];

for (const item of WINGS) useGLTF.preload(`/models/${ROOM}/${item.file}`);

/**
 * A hanging banner, painted rather than modelled.
 *
 * Cloth with lettering on it is the one thing in this room that has to say a
 * word, and a word is a texture. Drawing it on a canvas at startup means no
 * image to ship, no font to load and no atlas to keep in step with the text —
 * changing what the banner says is changing a string.
 */
function bannerTexture(text: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  // Matched to the shape of the cloth it goes on. A square texture stretched
  // over a wide banner squashes the lettering, which is what happened first.
  canvas.width = 640;
  canvas.height = 200;
  const ink = canvas.getContext("2d");

  if (ink) {
    ink.fillStyle = "#8f1824";
    ink.fillRect(0, 0, 640, 200);
    ink.strokeStyle = "#f5990a";
    ink.lineWidth = 3;
    ink.strokeRect(16, 16, 608, 168);

    // A cup on the left, drawn the way the interface draws its own.
    ink.strokeStyle = "#f0e8d9";
    ink.lineWidth = 8;
    ink.lineJoin = "round";
    ink.lineCap = "round";
    ink.beginPath();
    ink.moveTo(74, 92);
    ink.lineTo(154, 92);
    ink.lineTo(154, 118);
    ink.arc(114, 118, 40, 0, Math.PI);
    ink.lineTo(74, 92);
    ink.stroke();
    ink.beginPath();
    ink.arc(162, 106, 20, -Math.PI / 2, Math.PI / 2);
    ink.stroke();
    ink.lineWidth = 6;
    for (const x of [94, 114, 134]) {
      ink.beginPath();
      ink.moveTo(x, 78);
      ink.quadraticCurveTo(x + 12, 64, x, 50);
      ink.stroke();
    }

    ink.fillStyle = "#f0e8d9";
    ink.font = "600 58px system-ui, -apple-system, sans-serif";
    ink.textAlign = "center";
    ink.textBaseline = "middle";
    ink.fillText(text, 400, 104);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Strung along the barrier at the front of the audience.
 *
 * Hung high and far back they were never seen, and the arithmetic says why:
 * the camera sits low and looks down, so at the crowd's distance the top of
 * the frame is only a couple of units off the floor. Anything above that is
 * outside the picture no matter how big it is. On the barrier they are inside
 * the frame, they read against the dark mass of people behind them, and it is
 * where a hall hangs its hoardings anyway.
 */
const BANNER_Y = 8.2;
const BANNERS: readonly { text: string; x: number; z: number }[] = [
  { text: "CAFÉ", x: -8.4, z: -1.35 },
  { text: "BARISTA", x: 0, z: -1.35 },
  { text: "TINTO", x: 8.4, z: -1.35 },
];

function Banners() {
  const textures = useMemo(
    () => BANNERS.map((banner) => bannerTexture(banner.text)),
    [],
  );

  return (
    <group>
      {BANNERS.map((banner, i) => (
        <group key={banner.text} position={[banner.x, BANNER_Y, banner.z]}>
          {/* The cloth. Lit from its own face, because a banner at the back of
              a dark hall that is not lit is not a banner, it is a rectangle. */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[6.4, 2.0]} />
            <meshStandardMaterial
              map={textures[i]}
              roughness={0.95}
              emissive="#ffffff"
              emissiveMap={textures[i]}
              emissiveIntensity={0.3}
            />
          </mesh>
          {/* The rail it is lashed to. */}
          <mesh position={[0, 0, 1.1]} rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 6.8, 8]} />
            <meshStandardMaterial color="#f5990a" roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Cafe() {
  const seats = useMemo(
    () =>
      buildSeats({
        rows: ROWS,
        perRow: PER_ROW,
        spacing: SPACING,
        front: FRONT_Y,
        depth: ROW_DEPTH,
        rise: ROW_RISE,
        floor: FLOOR_Z,
      }),
    [],
  );

  return (
    <group>
      {/* Floor. A plane rather than tiled models: it is a flat colour either
          way, and one mesh instead of a hundred. */}
      <mesh position={[0, 3, FLOOR_Z]} receiveShadow>
        <planeGeometry args={[70, 60]} />
        <meshStandardMaterial color="#3c1a16" roughness={0.9} metalness={0.02} />
      </mesh>

      {/*
        The rake, as one dark slope rather than a flight of steps. Nobody can
        see the floor under a crowd in the dark, and the boxes that were there
        before were the biggest, brightest thing in the frame.
      */}
      {Array.from({ length: ROWS }, (_, row) =>
        row === 0 ? null : (
          <mesh
            key={`riser-${row}`}
            position={[
              0,
              FRONT_Y + row * ROW_DEPTH,
              FLOOR_Z + (row * ROW_RISE) / 2,
            ]}
          >
            <boxGeometry args={[HALL * 2, ROW_DEPTH + 0.6, row * ROW_RISE]} />
            <meshStandardMaterial color="#1e0a10" roughness={1} />
          </mesh>
        ),
      )}

      <Crowd seats={seats} />

      {/* A rail between the audience and the counter. */}
      <mesh position={[0, FRONT_Y - 2.6, FLOOR_Z + 1.5]}>
        <boxGeometry args={[HALL * 1.8, 0.16, 0.16]} />
        <meshStandardMaterial color="#f5990a" roughness={0.34} metalness={0.7} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={`post-${side}`}
          position={[side * HALL * 0.8, FRONT_Y - 2.6, FLOOR_Z + 0.75]}
        >
          <boxGeometry args={[0.16, 0.16, 1.5]} />
          <meshStandardMaterial color="#f5990a" roughness={0.34} metalness={0.7} />
        </mesh>
      ))}

      {/* A dark backdrop for the crowd to be read against. Without something
          behind them the far rows dissolve into the background colour. */}
      <mesh position={[0, WALL_Y, FLOOR_Z + 9]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALL * 4, 26]} />
        <meshStandardMaterial color="#16040a" roughness={1} />
      </mesh>

      {/*
        Haze in the beams.

        This is the one addition that does more for how the room looks than
        anything else in it. A cone of faint, additive light under each lamp
        stands in for dust in the air, and it is what turns three glowing bulbs
        into three shafts of light falling on a stage. It writes no depth, so
        it never hides anything behind it.
      */}
      {[-5.2, 0, 5.2].map((x) => (
        <mesh
          key={`beam-${x}`}
          // Apex at the lamp, mouth on the counter. Turned the other way it
          // was a funnel widening into the ceiling, which is why the first
          // attempt whited out the top of the frame.
          position={[x, 1.6, 1.7]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <coneGeometry args={[2.1, 4.6, 20, 1, true]} />
          <meshBasicMaterial
            color="#ffc46b"
            transparent
            opacity={0.028}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/*
        Little warm lights away in the dark behind the audience — the far end of
        the room, other tables, whatever the player cares to read them as. They
        give the black back there a depth it cannot get from geometry.
      */}
      {Array.from({ length: 26 }, (_, i) => {
        const a = Math.sin(i * 12.9898) * 43758.5453;
        const b = Math.sin(i * 78.233) * 12345.678;
        const x = ((a - Math.floor(a)) - 0.5) * 46;
        const y = 26 + (b - Math.floor(b)) * 14;
        const z = FLOOR_Z + 1.5 + ((a * 7 - Math.floor(a * 7))) * 7;
        return (
          <mesh key={`spark-${i}`} position={[x, y, z]}>
            <sphereGeometry args={[0.16, 6, 5]} />
            <meshBasicMaterial color="#f5990a" transparent opacity={0.75} />
          </mesh>
        );
      })}

      <Banners />

      {WINGS.map((item, i) => (
        <Decor key={`${item.file}-${i}`} {...item} />
      ))}

      {/* Stage lights over the counter. The glow is the lamp; the light itself
          is rigged in the scene so the two can be tuned apart. */}
      {[-5.2, 0, 5.2].map((x) => (
        <group key={`pendant-${x}`} position={[x, 1.6, 4.2]}>
          <mesh position={[0, 0, 2.3]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 4.6, 6]} />
            <meshStandardMaterial color="#2a1c12" roughness={0.8} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.62, 0.7, 20, 1, true]} />
            <meshStandardMaterial
              color="#8f1824"
              roughness={0.45}
              metalness={0.5}
              side={2}
            />
          </mesh>
          {/* The hot filament, which is what makes it read as lit rather than
              as a brown cone hanging in the dark. */}
          <mesh position={[0, 0, -0.26]}>
            <sphereGeometry args={[0.17, 12, 10]} />
            <meshStandardMaterial
              color="#fff0cf"
              emissive="#ffc46b"
              emissiveIntensity={3.2}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
