"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from "three";
import { buildSeats, Crowd } from "./crowd";
import { KitModel } from "./kit";

/**
 * The room behind the counter — quiet café depth, not a packed hall.
 *
 * The play space is the bar. Everything behind it should say “you’re in a
 * coffee shop” without competing for attention: a warm wall, soft windows,
 * a thin row of distant guests, and décor in the wings. Dense crowds and
 * hanging banners used to look like UI and stole the frame.
 */

/** Where the floor sits, taking the counter for bar height. */
export const FLOOR_Z = -3.1;
/** Back wall — closer than the old arena so the room feels intimate. */
const WALL_Y = 18.5;
/** First (and only dense) guest row, well behind the bar. */
const FRONT_Y = 12.2;
const ROW_DEPTH = 2.6;
const ROW_RISE = 0.85;
/** Two thin rows — suggestion of people, not a wall of bottles. */
const ROWS = 2;
const PER_ROW = 9;
const SPACING = 2.35;
const HALL = 18;

const ROOM = "cafe";

type Placed = {
  file: string;
  size: number;
  at: readonly [number, number, number];
  yaw?: number;
};

function Decor({ file, size, at, yaw = 0 }: Placed) {
  return (
    <group position={[at[0], at[1], at[2]]}>
      <KitModel file={file} dir={ROOM} size={size} yaw={yaw} shadows={false} />
    </group>
  );
}

/** Wings frame the bar; kept sparse so the middle stays for gameplay. */
const WINGS: readonly Placed[] = [
  { file: "bookcaseOpen.glb", size: 4.8, at: [-12.8, 3.2, FLOOR_Z], yaw: 1.45 },
  { file: "bookcaseClosedDoors.glb", size: 3.8, at: [13.0, 3.4, FLOOR_Z], yaw: -1.45 },
  { file: "pottedPlant.glb", size: 2.8, at: [-10.2, 1.8, FLOOR_Z] },
  { file: "pottedPlant.glb", size: 2.4, at: [10.4, 2.0, FLOOR_Z], yaw: 0.6 },
  { file: "barrel.glb", size: 2.0, at: [-11.2, 5.0, FLOOR_Z], yaw: 0.4 },
  { file: "stoolBar.glb", size: 2.4, at: [-7.6, -5.8, FLOOR_Z] },
  { file: "stoolBar.glb", size: 2.4, at: [7.6, -5.8, FLOOR_Z] },
];

/** Lounge behind the rail — tables and seats so the crowd sits in a café. */
const LOUNGE: readonly Placed[] = [
  { file: "tableRound.glb", size: 2.35, at: [-5.4, 11.6, FLOOR_Z], yaw: 0.2 },
  { file: "tableRound.glb", size: 2.2, at: [0.15, 12.4, FLOOR_Z], yaw: -0.3 },
  { file: "tableRound.glb", size: 2.3, at: [5.6, 11.5, FLOOR_Z], yaw: 0.5 },
  { file: "chairRounded.glb", size: 1.55, at: [-6.4, 12.5, FLOOR_Z], yaw: 0.4 },
  { file: "chairRounded.glb", size: 1.5, at: [-4.3, 12.4, FLOOR_Z], yaw: -0.5 },
  { file: "chairRounded.glb", size: 1.5, at: [-0.85, 13.3, FLOOR_Z], yaw: 0.15 },
  { file: "chairRounded.glb", size: 1.48, at: [1.15, 13.2, FLOOR_Z], yaw: -0.35 },
  { file: "chairRounded.glb", size: 1.52, at: [4.55, 12.4, FLOOR_Z], yaw: 0.55 },
  { file: "chairRounded.glb", size: 1.5, at: [6.55, 12.3, FLOOR_Z], yaw: -0.45 },
  { file: "loungeSofa.glb", size: 3.4, at: [8.8, 15.2, FLOOR_Z], yaw: -1.15 },
  { file: "loungeChair.glb", size: 1.85, at: [-9.0, 14.8, FLOOR_Z], yaw: 1.05 },
  { file: "sideTable.glb", size: 1.35, at: [-8.1, 15.6, FLOOR_Z], yaw: 0.4 },
  { file: "lampRoundTable.glb", size: 1.45, at: [-8.1, 15.6, FLOOR_Z + 0.85] },
  { file: "rugRectangle.glb", size: 7.2, at: [0, 13.0, FLOOR_Z + 0.09], yaw: 0.04 },
  { file: "pottedPlant.glb", size: 2.2, at: [-10.6, 16.2, FLOOR_Z], yaw: 0.3 },
  { file: "pottedPlant.glb", size: 2.0, at: [10.4, 16.0, FLOOR_Z], yaw: -0.4 },
  { file: "plantSmall2.glb", size: 1.1, at: [-5.4, 11.6, FLOOR_Z + 1.15] },
  { file: "mug.glb", size: 0.42, at: [0.35, 12.35, FLOOR_Z + 1.12], yaw: 0.6 },
  { file: "cup-tea.glb", size: 0.4, at: [5.35, 11.45, FLOOR_Z + 1.1], yaw: -0.3 },
];

for (const item of WINGS) useGLTF.preload(`/models/${ROOM}/${item.file}`);
for (const item of LOUNGE) useGLTF.preload(`/models/${ROOM}/${item.file}`);

/**
 * One quiet brand mark on the back wall — not three menu-sized banners.
 */
function brandTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ink = canvas.getContext("2d");
  if (ink) {
    ink.clearRect(0, 0, 512, 160);
    ink.fillStyle = "rgba(143, 24, 36, 0.92)";
    ink.fillRect(24, 24, 464, 112);
    ink.strokeStyle = "#f5990a";
    ink.lineWidth = 3;
    ink.strokeRect(24, 24, 464, 112);
    const family =
      (typeof document !== "undefined" &&
        getComputedStyle(document.documentElement)
          .getPropertyValue("--font-poppins")
          .trim()) ||
      "Poppins";
    ink.fillStyle = "#f0e8d9";
    ink.font = `700 42px ${family}, Poppins, system-ui, sans-serif`;
    ink.textAlign = "center";
    ink.textBaseline = "middle";
    ink.fillText("LA MEJOR TAZA", 256, 84);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function WindowBay({
  x,
  z,
  w,
  h,
}: {
  x: number;
  z: number;
  w: number;
  h: number;
}) {
  const y = WALL_Y - 0.06;
  const frame = 0.16;
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#140c18" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[w * 0.9, h * 0.9]} />
        <meshBasicMaterial
          color="#ffb070"
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[w * 0.55, h * 0.55]} />
        <meshBasicMaterial
          color="#ffe6c4"
          transparent
          opacity={0.1}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Frame and mullions — a real window, not a floating glow. */}
      <mesh position={[0, 0, h / 2]}>
        <boxGeometry args={[w + frame, 0.14, frame]} />
        <meshStandardMaterial color="#3d1c16" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, -h / 2]}>
        <boxGeometry args={[w + frame, 0.14, frame]} />
        <meshStandardMaterial color="#3d1c16" roughness={0.7} />
      </mesh>
      <mesh position={[-w / 2, 0, 0]}>
        <boxGeometry args={[frame, 0.14, h]} />
        <meshStandardMaterial color="#3d1c16" roughness={0.7} />
      </mesh>
      <mesh position={[w / 2, 0, 0]}>
        <boxGeometry args={[frame, 0.14, h]} />
        <meshStandardMaterial color="#3d1c16" roughness={0.7} />
      </mesh>
      <mesh>
        <boxGeometry args={[w * 0.045, 0.1, h * 0.92]} />
        <meshStandardMaterial color="#5a2a1c" roughness={0.65} />
      </mesh>
      <mesh>
        <boxGeometry args={[w * 0.92, 0.1, h * 0.045]} />
        <meshStandardMaterial color="#5a2a1c" roughness={0.65} />
      </mesh>
      <mesh position={[0, -0.08, -h / 2 - 0.12]}>
        <boxGeometry args={[w + 0.35, 0.28, 0.16]} />
        <meshStandardMaterial color="#6a3a22" roughness={0.6} />
      </mesh>
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
  const brand = useMemo(() => brandTexture(), []);

  return (
    <group>
      {/* Floor — warm wood tone, quiet. */}
      <mesh position={[0, 4, FLOOR_Z]} receiveShadow>
        <planeGeometry args={[48, 36]} />
        <meshStandardMaterial color="#3d1e18" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Lounge boards — a café room, not a black pit under the guests. */}
      <mesh position={[0, FRONT_Y + 1.4, FLOOR_Z + 0.04]}>
        <boxGeometry args={[HALL * 1.55, 7.2, 0.08]} />
        <meshStandardMaterial color="#4a281c" roughness={0.86} />
      </mesh>
      {[-2.4, -0.8, 0.8, 2.4].map((offset, i) => (
        <mesh
          key={`plank-${i}`}
          position={[0, FRONT_Y + 1.4 + offset, FLOOR_Z + 0.055]}
        >
          <boxGeometry args={[HALL * 1.5, 0.08, 0.02]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#3a1e16" : "#542c20"}
            roughness={0.9}
          />
        </mesh>
      ))}

      {/* Side walls so the hall has corners. */}
      <mesh
        position={[-HALL * 1.05, 8, FLOOR_Z + 6]}
        rotation={[Math.PI / 2, 0, Math.PI / 2]}
      >
        <planeGeometry args={[22, 14]} />
        <meshStandardMaterial color="#241014" roughness={1} />
      </mesh>
      <mesh
        position={[HALL * 1.05, 8, FLOOR_Z + 6]}
        rotation={[Math.PI / 2, 0, -Math.PI / 2]}
      >
        <planeGeometry args={[22, 14]} />
        <meshStandardMaterial color="#241014" roughness={1} />
      </mesh>

      {/* Ceiling — closes the room instead of opening onto the void. */}
      <mesh position={[0, 10, FLOOR_Z + 11.2]} rotation={[Math.PI, 0, 0]}>
        <planeGeometry args={[HALL * 2.2, 28]} />
        <meshStandardMaterial color="#14080c" roughness={1} />
      </mesh>

      {/* Back plaster + wine wash + wood wainscot. */}
      <mesh position={[0, WALL_Y, FLOOR_Z + 7]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALL * 2.4, 18]} />
        <meshStandardMaterial color="#2a1218" roughness={0.95} />
      </mesh>
      <mesh
        position={[0, WALL_Y - 0.03, FLOOR_Z + 4.2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[HALL * 1.9, 9]} />
        <meshBasicMaterial
          color="#7a2430"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, WALL_Y - 0.05, FLOOR_Z + 1.55]}>
        <boxGeometry args={[HALL * 2.15, 0.22, 3.1]} />
        <meshStandardMaterial color="#4a241c" roughness={0.78} />
      </mesh>
      <mesh position={[0, WALL_Y - 0.08, FLOOR_Z + 3.12]}>
        <boxGeometry args={[HALL * 2.15, 0.08, 0.08]} />
        <meshStandardMaterial color="#c4782a" roughness={0.4} metalness={0.45} />
      </mesh>

      <WindowBay x={-6.8} z={FLOOR_Z + 5.4} w={4.4} h={3.6} />
      <WindowBay x={6.8} z={FLOOR_Z + 5.4} w={4.4} h={3.6} />

      {/* Center alcove for the brand, between the windows. */}
      <mesh position={[0, WALL_Y - 0.1, FLOOR_Z + 2.55]}>
        <boxGeometry args={[6.2, 0.18, 3.4]} />
        <meshStandardMaterial color="#1c0a10" roughness={0.9} />
      </mesh>
      <mesh
        position={[0, WALL_Y - 0.22, FLOOR_Z + 2.35]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[5.2, 1.6]} />
        <meshStandardMaterial
          map={brand}
          transparent
          roughness={0.9}
          emissive="#ffffff"
          emissiveMap={brand}
          emissiveIntensity={0.32}
        />
      </mesh>

      {/* String of warm bulbs along the back wall. */}
      {[-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10].map((x, i) => (
        <mesh key={`bulb-${i}`} position={[x, WALL_Y - 0.35, FLOOR_Z + 7.15]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial
            color="#fff0cf"
            emissive="#ffc46b"
            emissiveIntensity={1.8 + (i % 3) * 0.4}
            toneMapped={false}
          />
        </mesh>
      ))}

      <pointLight
        position={[0, FRONT_Y + 0.6, 3.6]}
        intensity={16}
        distance={14}
        decay={2}
        color="#ffc46b"
      />
      <pointLight
        position={[-6.8, WALL_Y - 1.2, 4.6]}
        intensity={9}
        distance={11}
        decay={2}
        color="#ffb070"
      />
      <pointLight
        position={[6.8, WALL_Y - 1.2, 4.6]}
        intensity={9}
        distance={11}
        decay={2}
        color="#ffb070"
      />

      <group scale={[0.92, 0.92, 0.92]}>
        <Crowd seats={seats} />
      </group>

      {/* Divider rail with posts — a bar, not a floating stick. */}
      {[-7.8, 0, 7.8].map((x) => (
        <mesh key={`post-${x}`} position={[x, FRONT_Y - 3.4, FLOOR_Z + 0.55]}>
          <boxGeometry args={[0.12, 0.12, 1.1]} />
          <meshStandardMaterial color="#3d1c16" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, FRONT_Y - 3.4, FLOOR_Z + 1.15]}>
        <boxGeometry args={[HALL * 1.15, 0.12, 0.1]} />
        <meshStandardMaterial color="#c4782a" roughness={0.4} metalness={0.55} />
      </mesh>

      {[-4.4, 0, 4.4].map((x) => (
        <mesh
          key={`beam-${x}`}
          position={[x, 1.4, 1.5]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <coneGeometry args={[1.7, 4.0, 18, 1, true]} />
          <meshBasicMaterial
            color="#ffc46b"
            transparent
            opacity={0.022}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {[
        [-5.4, 11.6],
        [0.15, 12.4],
        [5.6, 11.5],
      ].map(([x, y], i) => (
        <mesh key={`candle-${i}`} position={[x, y, FLOOR_Z + 1.42]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial
            color="#fff0cf"
            emissive="#f5990a"
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {WINGS.map((item, i) => (
        <Decor key={`wing-${item.file}-${i}`} {...item} />
      ))}
      {LOUNGE.map((item, i) => (
        <Decor key={`lounge-${item.file}-${i}`} {...item} />
      ))}

      {[-4.4, 4.4].map((x) => (
        <group key={`pendant-${x}`} position={[x, 1.4, 4.0]}>
          <mesh position={[0, 0, 2.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 4.2, 8]} />
            <meshStandardMaterial color="#2a1c12" roughness={0.8} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.52, 0.62, 20, 1, true]} />
            <meshStandardMaterial
              color="#8f1824"
              roughness={0.45}
              metalness={0.5}
              side={2}
            />
          </mesh>
          <mesh position={[0, 0, -0.22]}>
            <sphereGeometry args={[0.15, 14, 12]} />
            <meshStandardMaterial
              color="#fff0cf"
              emissive="#ffc46b"
              emissiveIntensity={2.8}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {[-5.4, 0.15, 5.6].map((x) => (
        <group key={`lounge-lamp-${x}`} position={[x, 12.2, 3.35]}>
          <mesh position={[0, 0, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 2.3, 8]} />
            <meshStandardMaterial color="#2a1c12" roughness={0.8} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.32, 0.4, 16, 1, true]} />
            <meshStandardMaterial
              color="#8f1824"
              roughness={0.5}
              metalness={0.4}
              side={2}
            />
          </mesh>
          <mesh position={[0, 0, -0.14]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshStandardMaterial
              color="#fff0cf"
              emissive="#ffc46b"
              emissiveIntensity={2.2}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
