import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Off, and not lightly.
   *
   * Strict mode mounts every component twice in development to shake out
   * effects that are not safe to re-run. For ordinary components that is a
   * good trade. For a WebGL canvas it is not: mounting twice builds a second
   * renderer, with its own shadow map, its own environment cube and its own
   * copy of every compiled shader, before the first one has let go of its. On
   * this scene that was enough to lose the graphics context outright, so the
   * game ran in production and showed a blank grey canvas in development —
   * which is the worst possible way round.
   *
   * The scene's own effects are all idempotent (they measure a model, fit it
   * and position it), so the double mount was buying nothing here.
   */
  reactStrictMode: false,
};

export default nextConfig;
