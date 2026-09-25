import type { Metadata, Viewport } from "next";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/900.css";
import "./globals.css";

/**
 * Poppins ships inside the app through Fontsource. It never depends on Google
 * during development, build or runtime, so every screen uses the same family
 * even when the machine is offline.
 */

export const metadata: Metadata = {
  title: "Café a mano",
  description:
    "Prepara café con una mano. El seguimiento corre en tu navegador: pellizca para tomar, abre la palma para soltar.",
};

export const viewport: Viewport = {
  themeColor: "#2b070c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
