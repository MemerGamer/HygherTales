# Security checklist

## API key only on server

- **CurseForge API key** is used **only** by the proxy server (`apps/proxy`). It is read from the server environment (e.g. `CURSEFORGE_API_KEY` in `.env` or Docker `-e`).
- The **desktop app** never receives, stores, or sends the API key. All CurseForge requests from the desktop go through the proxy; the proxy adds the key server-side.
- **Distribution**: Desktop builds (Windows/macOS/Linux) do not bundle any API keys or secrets. Users configure the proxy URL in Settings; the key stays on the machine running the proxy.

## Rate limiting on proxy

- The proxy applies **per-IP rate limiting** (configurable via `RATE_LIMIT_PER_MIN`, default 60 requests/minute). This reduces abuse and keeps usage within CurseForge API expectations.
- Rate limiting is applied before route handlers. When exceeded, the proxy returns `429` with `RATE_LIMITED`; no API key is ever included in responses.

## Minimal logging, no key leakage

- The proxy does **not** log the API key or any request/response bodies that could contain secrets.
- Startup logging is minimal (e.g. port only). No env vars are printed or logged.
- Error responses use generic messages; internal details (e.g. CurseForge error bodies) are not logged in a way that could expose the key.

## Best practices for deployers

- Run the proxy in a restricted environment (e.g. container or dedicated user) and expose only the port you need.
- Use HTTPS and appropriate `CORS_ORIGINS` when the desktop or a web client talks to a hosted proxy.
- Keep `CURSEFORGE_API_KEY` in a secret store (e.g. GitHub Actions secrets, Docker secrets, or env files with restricted permissions); never commit it or bake it into images.
- Prefer building the proxy Docker image without secrets and passing `CURSEFORGE_API_KEY` at `docker run` (or via your orchestrator’s secret mechanism).

## Reporting issues

If you find a security concern, please open a GitHub issue or contact the maintainers privately; avoid posting secrets or detailed exploit steps in public issues.
