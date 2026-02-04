# HygherTales Proxy API Contract (Hytale mods only)

Request/response shapes and examples. All response payloads can be validated with the zod schemas in `@hyghertales/shared`. The proxy serves **Hytale** mods from **CurseForge** and **Orbis.place**.

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

**GET** `/v1/search?q=...&page=1&pageSize=20&categoryId=&sortField=&sortOrder=`

Optional query params (inspired by HyPrism/CurseForge): `categoryId` (filter by category), `sortField` (1=Featured, 2=Popularity, 3=LastUpdated, 4=Name, 5=Author, 6=TotalDownloads), `sortOrder` (`asc` or `desc`).

### Request: `ModSearchRequest`

```json
{
  "q": "potion",
  "page": 1,
  "pageSize": 20,
  "categoryId": 0,
  "sortField": 2,
  "sortOrder": "desc"
}
```

### Response: `ModSearchResponse`

```json
{
  "items": [
    {
      "provider": "curseforge",
      "projectId": 123456,
      "slug": "epics-potion-trader",
      "name": "Epic's Potion Trader",
      "summary": "A Hytale mod that adds...",
      "logoUrl": "https://..."
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 42
}
```

Search/featured responses may also contain **Orbis.place** items (when using `/v1/orbis/featured` or `/v1/orbis/search`). Those items use the same `ModSearchResponse` shape with `provider: "orbis"` and `resourceId` instead of `projectId`:

```json
{
  "items": [
    {
      "provider": "orbis",
      "resourceId": "cmkcxg67b000g01s6ewk287pn",
      "slug": "cleanstaffchat",
      "name": "CleanStaffChat",
      "summary": "Clean StaffChat is a basic StaffChat plugin...",
      "logoUrl": "https://media.orbis.place/..."
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 68
}
```

---

## Mod categories

**GET** `/v1/categories`

Returns Hytale mod categories for the filter dropdown (subcategories under the “Mods” class, as in HyPrism).

### Response: `ModCategoriesResponse`

```json
{
  "categories": [
    { "id": 123, "name": "Quality of Life", "slug": "quality-of-life" },
    { "id": 456, "name": "Gameplay", "slug": "gameplay" }
  ]
}
```

---

## Mod details

**GET** `/v1/mod/:projectId`

### Response: `ModDetailsResponse`

```json
{
  "provider": "curseforge",
  "projectId": 123456,
  "slug": "epics-potion-trader",
  "name": "Epic's Potion Trader",
  "summary": "A Hytale mod that adds...",
  "logoUrl": "https://...",
  "description": "Full markdown or plain text description..."
}
```

---

## Mod files

**GET** `/v1/mod/:projectId/files`

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

**POST** `/v1/resolve-from-url`

Resolve a CurseForge **Hytale** mod page URL to provider + projectId + slug. Only `curseforge.com/hytale/mods/<slug>` URLs are accepted.

### Request: `ResolveFromUrlRequest`

```json
{
  "url": "https://www.curseforge.com/hytale/mods/epics-potion-trader"
}
```

### Response: `ResolveFromUrlResponse`

```json
{
  "provider": "curseforge",
  "projectId": 123456,
  "slug": "epics-potion-trader"
}
```

---

## Download (helper)

**GET** `/v1/download/:projectId/:fileId`

Returns a temporary download URL for a mod file. The desktop app can use this without the CurseForge API key. Do not log full URLs; they may contain tokens.

### Response: `DownloadResponse`

```json
{
  "url": "https://edge.forgecdn.net/files/1234/567/mod.jar"
}
```

### Error: `DOWNLOAD_NOT_AVAILABLE` (503)

When CurseForge does not provide a URL (e.g. distribution blocked or file not accessible):

```json
{
  "code": "DOWNLOAD_NOT_AVAILABLE",
  "message": "Download URL is not available for this file (CurseForge may block distribution or the file is not accessible)."
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
