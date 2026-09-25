import type { Metadata } from "next";
import { HandTrackedApp } from "@/components/HandTrackedApp";

export const metadata: Metadata = {
  title: "Jugar · Café a mano",
  description:
    "Prepara café con una mano: pellizca para tomar, abre la palma para soltar.",
};

export default function Jugar() {
  return <HandTrackedApp />;
}
