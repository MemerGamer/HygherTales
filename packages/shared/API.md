# HygherTales Proxy API Contract

Request/response shapes and examples. All response payloads can be validated with the zod schemas in `@hyghertales/shared`.

---

## Health

**GET** `/health`

Liveness check.

### Response: `HealthResponse`

```json
{
  "ok": true
}
```

---

## Mod search

**GET** `/mods/search?q=...&page=1&pageSize=20`  
(or equivalent POST with body)

### Request: `ModSearchRequest`

```json
{
  "q": "fabric",
  "page": 1,
  "pageSize": 20
}
```

### Response: `ModSearchResponse`

```json
{
  "items": [
    {
      "provider": "curseforge",
      "projectId": 306612,
      "slug": "fabric-api",
      "name": "Fabric API",
      "summary": "Core API for the Fabric toolchain.",
      "logoUrl": "https://cdn.modrinth.com/..."
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 42
}
```

---

## Mod details

**GET** `/mods/:provider/:projectId` or `/mods/:provider/:slug`

### Response: `ModDetailsResponse`

```json
{
  "provider": "curseforge",
  "projectId": 306612,
  "slug": "fabric-api",
  "name": "Fabric API",
  "summary": "Core API for the Fabric toolchain.",
  "logoUrl": "https://cdn.modrinth.com/...",
  "description": "Full markdown or plain text description..."
}
```

---

## Mod files

**GET** `/mods/:provider/:projectId/files` (or equivalent)

### Response: `ModFilesResponse`

```json
{
  "files": [
    {
      "fileId": 12345678,
      "fileName": "fabric-api-0.100.0+1.20.1.jar",
      "displayName": "0.100.0 for 1.20.1",
      "releaseType": "release",
      "fileDate": "2024-01-15T12:00:00.000Z",
      "downloadUrl": "https://..."
    },
    {
      "fileId": 12345679,
      "fileName": "fabric-api-0.99.0+1.20.1.jar",
      "displayName": null,
      "releaseType": "beta",
      "fileDate": "2024-01-01T00:00:00.000Z",
      "downloadUrl": null
    }
  ]
}
```

---

## Resolve from URL

**POST** `/mods/resolve`

Resolve a CurseForge (or other) mod page URL to a canonical provider + projectId + slug.

### Request: `ResolveFromUrlRequest`

```json
{
  "url": "https://www.curseforge.com/minecraft/mc-mods/fabric-api"
}
```

### Response: `ResolveFromUrlResponse`

```json
{
  "provider": "curseforge",
  "projectId": 306612,
  "slug": "fabric-api"
}
```

---

## Error

Any endpoint may return an error payload with a 4xx/5xx status.

### Response: `ErrorResponse`

```json
{
  "code": "NOT_FOUND",
  "message": "Mod project not found.",
  "details": null
}
```

With optional `details`:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request.",
  "details": {
    "path": ["query", "page"],
    "expected": "number >= 1"
  }
}
```
