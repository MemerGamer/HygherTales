const PORT_DEFAULT = 8787;

const RATE_LIMIT_PER_MIN_DEFAULT = 60;

function getEnv(): {
  CURSEFORGE_API_KEY: string;
  PORT: number;
  CURSEFORGE_GAME_ID: number | undefined;
  CORS_ORIGINS: string[];
  RATE_LIMIT_PER_MIN: number;
} {
  const key = Bun.env.CURSEFORGE_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "CURSEFORGE_API_KEY is required. Set it in .env or the environment."
    );
  }

  const portRaw = Bun.env.PORT;
  const port = portRaw != null ? Number(portRaw) : PORT_DEFAULT;
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT: ${portRaw}. Must be 1-65535. Default is ${PORT_DEFAULT}.`
    );
  }

  const gameIdRaw = Bun.env.CURSEFORGE_GAME_ID;
  const CURSEFORGE_GAME_ID =
    gameIdRaw != null && gameIdRaw !== ""
      ? Number(gameIdRaw)
      : undefined;
  if (
    CURSEFORGE_GAME_ID !== undefined &&
    (Number.isNaN(CURSEFORGE_GAME_ID) || CURSEFORGE_GAME_ID < 1)
  ) {
    throw new Error(`Invalid CURSEFORGE_GAME_ID: ${gameIdRaw}.`);
  }

  // Comma-separated allowlist; default allows localhost in dev
  const corsRaw = Bun.env.CORS_ORIGINS;
  const CORS_ORIGINS =
    corsRaw != null && corsRaw !== ""
      ? corsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : ["http://localhost:1420", "http://localhost:5173", "http://localhost:3000"];

  const rateLimitRaw = Bun.env.RATE_LIMIT_PER_MIN;
  const RATE_LIMIT_PER_MIN =
    rateLimitRaw != null && rateLimitRaw !== ""
      ? Number(rateLimitRaw)
      : RATE_LIMIT_PER_MIN_DEFAULT;
  if (Number.isNaN(RATE_LIMIT_PER_MIN) || RATE_LIMIT_PER_MIN < 1) {
    throw new Error(
      `Invalid RATE_LIMIT_PER_MIN: ${rateLimitRaw}. Default is ${RATE_LIMIT_PER_MIN_DEFAULT}.`
    );
  }

  return {
    CURSEFORGE_API_KEY: key.trim(),
    PORT: port,
    CURSEFORGE_GAME_ID,
    CORS_ORIGINS,
    RATE_LIMIT_PER_MIN,
  };
}

export const env = getEnv();
