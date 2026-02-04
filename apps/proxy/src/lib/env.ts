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
      "CURSEFORGE_API_KEY is required. Set it in apps/proxy/.env (see README for how to get a key)."
    );
  }
  const trimmed = key.trim();

  const portRaw = Bun.env.PORT;
  const port = portRaw != null ? Number(portRaw) : PORT_DEFAULT;
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT: ${portRaw}. Must be 1-65535. Default is ${PORT_DEFAULT}.`
    );
  }

  const gameIdRaw = Bun.env.CURSEFORGE_GAME_ID;
  const parsed = gameIdRaw != null && gameIdRaw.trim() !== "" ? Number(gameIdRaw.trim()) : NaN;
  const CURSEFORGE_GAME_ID =
    typeof parsed === "number" && !Number.isNaN(parsed) && parsed >= 1 ? parsed : undefined;
  if (gameIdRaw != null && gameIdRaw.trim() !== "" && (CURSEFORGE_GAME_ID === undefined)) {
    throw new Error(
      `Invalid CURSEFORGE_GAME_ID: "${gameIdRaw}". It must be the numeric game ID (e.g. 12345), not the slug "hytale". ` +
        "Get the ID with: curl -H \"x-api-key: YOUR_KEY\" \"https://api.curseforge.com/v1/games?pageSize=50\" and use the \"id\" of the game with \"slug\": \"hytale\". See apps/proxy/README.md."
    );
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
    CURSEFORGE_API_KEY: trimmed,
    PORT: port,
    CURSEFORGE_GAME_ID,
    CORS_ORIGINS,
    RATE_LIMIT_PER_MIN,
  };
}

export const env = getEnv();
