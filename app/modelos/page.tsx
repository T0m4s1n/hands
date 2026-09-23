import type { Metadata } from "next";
import { ModelLab } from "@/components/ModelLab";

export const metadata: Metadata = {
  title: "Modelos · Café a mano",
  description:
    "Banco de pruebas: todas las piezas del juego con sus medidas y colliders.",
};

export default function Modelos() {
  return <ModelLab />;
}
