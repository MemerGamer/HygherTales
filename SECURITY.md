# Security

## API key isolation

- **CurseForge API key** lives only on the proxy server (env var or Docker secret)
- Desktop never receives, stores, or transmits the API key
- Desktop builds contain no secrets
- Users configure proxy URL in Settings; key stays on the proxy server

## Rate limiting

- Proxy enforces per-IP rate limits (default: 60 req/min, configurable via `RATE_LIMIT_PER_MIN`)
- Prevents abuse and keeps usage within CurseForge API limits
- Returns `429` when exceeded; no key in responses

## Logging

- Proxy does not log API keys or sensitive data
- Startup message logs port only
- Error responses are generic; no CurseForge internals exposed

## Deployment best practices

- Run proxy in container or isolated environment
- Use HTTPS for production deployments
- Set `CORS_ORIGINS` appropriately
- Store `CURSEFORGE_API_KEY` in secret manager (GitHub Actions secrets, Docker secrets, env files with restricted permissions)
- Never commit secrets or bake them into images

## Reporting issues

Open a GitHub issue for security concerns. Avoid posting secrets or exploit details publicly.
