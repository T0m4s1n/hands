import type { Metadata } from "next";
import { HandTrackedApp } from "@/components/HandTrackedApp";

export const metadata: Metadata = {
  title: "Jugar · Café a mano",
  description:
    "Prepara café con las manos: pellizca para tomar, abre la mano para soltar.",
};

export default function Jugar() {
  return <HandTrackedApp />;
}
