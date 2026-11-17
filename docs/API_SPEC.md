# API Specification (v1)

Base URL: `https://api.yourdomain.com/v1`
Format: JSON. Auth: `Authorization: Bearer <access_token>`. Errors follow the shape below.

```json
{ "error": { "code": "RATE_LIMITED", "message": "Too many requests", "retryAfter": 30 } }
```

## Auth

### `POST /auth/device`

Register an anonymous device and get tokens.

```json
// request
{ "deviceId": "uuid", "platform": "android", "appVersion": "1.0.0", "variant": "direct" }
// response
{ "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }
```

### `POST /auth/refresh`

Rotate tokens. Refresh tokens are single-use.

### `POST /auth/link-account` (P1)

Attach email or Google sign-in to a device to sync Pro across devices.

## Resolve

### `POST /resolve`

```json
// request
{ "url": "https://example.com/video/123" }
// 200 response
{
  "id": "res_abc",
  "source": "tiktok",
  "title": "Clip title",
  "thumbnail": "https://...",
  "duration": 34,
  "formats": [
    { "id": "f1", "type": "video", "quality": "720p", "ext": "mp4", "sizeBytes": 8123456, "url": "https://...", "headers": {}, "proOnly": false },
    { "id": "f2", "type": "audio", "quality": "128k", "ext": "m4a", "sizeBytes": 640000, "url": "https://...", "proOnly": false }
  ],
  "expiresAt": "2026-11-16T12:30:00Z"
}
// 202 response (still processing)
{ "jobId": "job_123", "retryAfter": 2 }
```

Errors: `INVALID_URL`, `UNSUPPORTED_SOURCE`, `SOURCE_UNAVAILABLE`, `RATE_LIMITED`, `PRO_REQUIRED`, `FEATURE_DISABLED` (store flavor).

### `GET /resolve/jobs/:jobId`

Poll job status: `pending | done | failed`, returns the resolve payload when done.

## Platform health

### `GET /platforms`

```json
{
  "platforms": [
    { "id": "tiktok", "status": "healthy" },
    { "id": "instagram", "status": "degraded" }
  ]
}
```

Used to show "temporarily unavailable" badges.

## App updates (direct flavor)

### `GET /app/latest?platform=android&current=1.0.0`

```json
{
  "version": "1.1.0",
  "mandatory": false,
  "changelog": "...",
  "apkUrl": "https://cdn.../mediavault-1.1.0.apk",
  "sha256": "...",
  "signingCertSha256": "..."
}
```

## Billing

### `POST /billing/license/activate` (direct)

```json
{ "licenseKey": "XXXX-XXXX-XXXX" }
```

### `POST /billing/webhook/revenuecat` (store)

### `POST /billing/webhook/paystack` and `/billing/webhook/stripe` (direct)

Webhooks verify signatures and update entitlements.

### `GET /me/entitlements`

```json
{
  "plan": "pro",
  "expiresAt": "2027-11-16T00:00:00Z",
  "limits": { "maxQuality": "2160p", "dailyResolves": null, "concurrent": 5 }
}
```

## Reports and support

### `POST /reports`

Report a broken link or content issue.

```json
{ "type": "broken_extraction", "url": "...", "note": "..." }
```

### `POST /takedown`

Copyright/takedown contact intake (also available as a public web form and email address).

## Rate limits (defaults)

| Tier   | Resolves                   | Burst |
| ------ | -------------------------- | ----- |
| Free   | 10 per day, 5 per minute   | 3     |
| Pro    | 300 per day, 20 per minute | 10    |
| Per IP | 60 per minute              |       |

## Versioning and compatibility

- URL-versioned (`/v1`). Breaking changes go in `/v2`.
- App sends `X-App-Version` and `X-App-Variant`. The server can force-upgrade very old versions via a `426` response.
