# Master Prompt: Start Building MediaVault

How to use:

1. Create the repo and put all docs in `/docs`. Keep `AGENTS.md` and `CLAUDE.md` in the repo root.
2. Open the repo in Claude Code (or Cursor / Codex).
3. Paste **Prompt 0 (Master)** first. Then use the phase prompts one at a time, only after the previous phase passes its checks.

---

## Prompt 0: Master (paste this first)

```
You are the lead engineer building "MediaVault" (working name): a premium mobile app
that downloads media, manages files and documents, and keeps private files in an
encrypted vault. It ships as two flavors from one codebase: `store` (Google Play /
App Store, no social-platform extraction code) and `direct` (APK from our website,
with remote extractors and a self-updater).

BEFORE WRITING ANY CODE
1. Read AGENTS.md and CLAUDE.md in the repo root.
2. Read every file in /docs: PRD.md, SCREENS_AND_NAVIGATION.md, USER_FLOWS.md,
   ARCHITECTURE.md, API_SPEC.md, DATABASE_SCHEMA.md, SECURITY.md, ROADMAP.md.
3. Reply with a short summary (max 15 lines) of: the product, the two flavors, the
   architecture, and the hard rules. Also list any contradictions, gaps, or risky
   assumptions you found in the docs. Wait for my confirmation before coding.

STACK (fixed unless I approve a change)
- Monorepo: pnpm workspaces + Turborepo
- Mobile: Expo (dev client, not Expo Go), React Native, TypeScript strict, Expo Router
- State/data: Zustand, TanStack Query, expo-sqlite
- Backend: Node.js, Fastify, Zod, BullMQ + Redis, PostgreSQL (Drizzle), yt-dlp worker
- Testing: Jest, React Native Testing Library, Maestro for E2E
- CI: GitHub Actions, builds via EAS

HARD RULES
- The `store` build must contain no platform-extraction code. Extractors live only in
  `src/features/extractors/` and load through `loadExtractors()`, which the store
  build aliases to a no-op.
- Flavor differences go through a single typed `FEATURES` object, never by checking
  APP_VARIANT inside UI code.
- Server resolves links only. The phone downloads directly from the source.
- Every server fetch of a user-supplied URL passes through an SSRF guard.
- Never log full URLs, tokens, or vault file names. No secrets in the repo or bundle.
- Every screen handles loading, empty, error, and offline states.
- Schema changes are numbered migrations. Never edit an old one.
- Entitlements are decided server-side (or by RevenueCat), never trusted from the client.

HOW YOU WORK
- Work in small, reviewable steps. After each step: run lint, typecheck, and tests,
  then show what changed and what is next.
- Map each task to PRD feature IDs (for example DL-06, FM-02).
- If a doc is ambiguous, ask one focused question instead of guessing.
- Ask before adding any dependency, and state why, its maintenance status, and size.
- Do not build features outside the current phase.
- If something in the docs is wrong or impossible on a platform (for example iOS
  background download limits or Android storage permissions), say so and propose
  the closest correct alternative.

OUTPUT FORMAT FOR EACH STEP
1. Goal and PRD IDs
2. Files created or changed
3. Commands to run and their results
4. Risks or follow-ups (flavor impact, security impact)
5. Proposed next step

Start now with the "BEFORE WRITING ANY CODE" section only.
```

---

## Prompt 1: Scaffold and foundations (Phase 0 and 1a)

```
Phase 1a: project foundation. Goal: a running app shell for both flavors.

Build:
1. Monorepo with pnpm + Turborepo: apps/mobile, apps/api, apps/worker,
   packages/shared, docs/. Shared tsconfig, ESLint, Prettier, Husky + lint-staged,
   Conventional Commits check.
2. apps/mobile: Expo (dev client) + Expo Router + TypeScript strict.
   - app.config.ts reading APP_VARIANT (store | direct): sets app name, package ID
     (com.yourbrand.mediavault and com.yourbrand.mediavault.direct), icon, and scheme.
   - eas.json with profiles: store-android, store-ios, direct-android, plus dev.
   - src/config/features.ts exporting the typed FEATURES object from ARCHITECTURE.md.
   - src/features/extractors/ with loadExtractors(), and Metro alias so the store
     build resolves it to a no-op. Add a test that proves the store bundle config
     excludes the extractors module.
3. Theme system: tokens from SCREENS_AND_NAVIGATION.md, dark-first with light and
   system modes, typed useTheme() hook, base components (Button, Card, Text, Chip,
   Sheet, EmptyState, ErrorState, Skeleton).
4. Navigation shell: onboarding (3 slides) and the 5 bottom tabs (Home, Library,
   Documents, Vault, Settings) with placeholder screens that already show proper
   empty states. Add the stack/modal routes listed in the docs as stubs.
5. CI: GitHub Actions running lint, typecheck, and tests on pull requests.

Done when: `pnpm lint && pnpm typecheck && pnpm test` pass, the app runs on an
Android emulator in both variants (different name and package ID), and navigation
works across all tabs. Stop and report when done.
```

---

## Prompt 2: Local database and file service (Phase 1b)

```
Phase 1b: local data layer.

Build:
1. expo-sqlite setup with a migration runner and schema_version table.
2. Migration 001 from DATABASE_SCHEMA.md: folders, files, downloads, vault_items,
   settings, plus the indexes.
3. Repository modules (files, folders, downloads, settings) with typed methods and
   unit tests using an in-memory or test database.
4. FileService: create/rename/move/copy/delete (soft delete to trash), category
   detection by MIME and extension, thumbnail generation for images and video,
   safe unique file naming.
5. Storage handling: app-scoped storage plus MediaStore export on Android. Do not
   request broad storage permissions. Explain your approach in a short note.

Done when: repositories have tests, a debug screen lists and creates folders and
files, and everything survives an app restart. Stop and report.
```

---

## Prompt 3: Download engine (Phase 1c)

```
Phase 1c: download engine for direct-file links (no extractors yet).

Build:
1. Download queue persisted in SQLite with the state machine from ARCHITECTURE.md:
   queued, resolving, downloading, paused, verifying, completed, failed, canceled.
2. Native background downloading. Evaluate the best option for Expo dev client
   (a maintained library or a small custom Expo module) and present the trade-offs
   BEFORE implementing. Wait for my choice.
3. Concurrency limit (1 free, 5 Pro), pause/resume via Range, retry with exponential
   backoff (max 3), Wi-Fi-only setting, resume after app kill and reboot.
4. Download notification with progress and actions.
5. UI: Home paste field with URL validation, preview sheet for direct links,
   Download Queue screen (Active / Completed / Failed) with swipe actions.
6. Completed downloads are indexed into the library automatically.

Tests: state machine unit tests, retry/backoff tests, and a Maestro flow that pastes
a direct file URL and verifies it appears in the library.

Done when: a large file download survives killing the app and a network switch.
Stop and report.
```

---

## Prompt 4: Library and file manager (Phase 1d)

```
Phase 1d: Library and file manager (FM-01 to FM-04).

Build the Library tab: category chips, grid/list toggle, search, sort, filters,
folders, multi-select with bulk actions (move, delete, favorite), trash with restore,
and per-state UI (loading skeleton, empty, error). Use virtualized lists and make
sure scrolling 5,000 items stays smooth. Include tests and one Maestro flow.
Stop and report with performance notes.
```

---

## Prompt 5: Backend resolver (Phase 2a)

```
Phase 2a: backend. Follow API_SPEC.md and SECURITY.md exactly.

Build apps/api (Fastify + Zod) and apps/worker:
1. Device auth: POST /auth/device, /auth/refresh (rotating single-use refresh tokens).
2. POST /resolve and GET /resolve/jobs/:id with BullMQ, Redis cache keyed by
   normalized URL, request coalescing, priority for Pro, and 429 + Retry-After
   backpressure.
3. SSRF guard module: scheme and port allowlist, own DNS resolution, private and
   metadata range blocking, redirect re-checks. Write thorough tests including DNS
   rebinding and redirect cases.
4. Worker container running yt-dlp: non-root, read-only filesystem, resource limits,
   timeout, no internal network access. Provide Dockerfile and docker-compose.
5. GET /platforms health endpoint plus an hourly canary job with a config file of
   test URLs per platform.
6. Postgres with Drizzle migrations from DATABASE_SCHEMA.md.
7. Rate limits per device and IP from API_SPEC.md.

Done when: integration tests pass, docker-compose brings up the whole backend
locally, and the SSRF test suite is green. Stop and report.
```

---

## Prompt 6: Connect resolver to app, share sheet, extractors (Phase 2b)

```
Phase 2b: connect the app to the resolver.

Build: typed API client with token refresh, Resolve flow in the preview sheet
(formats, quality, Pro badges), share-sheet intent and clipboard detection, platform
health badges, and the extractors feature module for the `direct` flavor only.
Verify the `store` build gives a clear "unsupported source" message and contains no
extractor code (add a CI check that inspects the bundle). Stop and report.
```

---

## Prompt 7 onward: remaining phases

```
Phase 2c: player (video + audio, background play, PiP), image and PDF viewers, and
the Vault (PIN, biometrics, AES-256-GCM chunked encryption, hardware-backed key
wrapping, auto-lock, FLAG_SECURE) exactly as in SECURITY.md.

Phase 3a: scanner and PDF tools (scan to PDF, merge, split, convert), storage
dashboard, duplicate finder.

Phase 3b: billing and paywall. RevenueCat for `store`, Paystack/Stripe license
activation for `direct`, server-side entitlements, limits enforced from
/me/entitlements.

Phase 3c: direct flavor self-updater with HTTPS, SHA-256 and signing-certificate
verification, plus the APK landing page.

Phase 4: performance and battery pass, accessibility pass, full security checklist
from SECURITY.md, load test of the resolver with k6, beta build, store listings.
```

Use the same "Output format for each step" and "Hard rules" from Prompt 0 in every phase.

---

## Tips for getting the best results

- Run one phase per session and commit between phases. Start a fresh session if the context gets long and re-run the "read the docs" step.
- Always review the plan before approving implementation on vault, auth, billing, and updater work.
- If the agent drifts, reply: "Re-read AGENTS.md hard rules and check your last change against them."
- Test on a real low-end Android device early, not just the emulator.
- Ask for a short "decision log" at the end of each phase and save it to `docs/DECISIONS.md`.
