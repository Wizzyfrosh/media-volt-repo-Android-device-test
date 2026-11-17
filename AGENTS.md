# AGENTS.md

Instructions for AI coding agents (Codex, Claude Code, Cursor, Copilot, and similar) working on MediaVault (working name). Humans can read it too.

## Project overview

Mobile app (React Native + Expo, TypeScript) to download media, manage files and documents, and keep private files in an encrypted vault. One codebase builds two flavors:

- `store`: Google Play / App Store, no social-platform extraction code
- `direct`: APK from our website, with remote extractors and a self-updater

Backend: Fastify + BullMQ (Redis) + PostgreSQL + yt-dlp workers. The server resolves links only. The phone downloads media directly from the source.

## Read first

| Need                            | File                        |
| ------------------------------- | --------------------------- |
| What to build and why           | `PRD.md`                    |
| Screens and routes              | `SCREENS_AND_NAVIGATION.md` |
| User journeys                   | `USER_FLOWS.md`             |
| System design, flavors, scaling | `ARCHITECTURE.md`           |
| Endpoints                       | `API_SPEC.md`               |
| Tables                          | `DATABASE_SCHEMA.md`        |
| Security rules                  | `SECURITY.md`               |
| Plan and test strategy          | `ROADMAP.md`                |
| Claude-specific context         | `CLAUDE.md`                 |

If code and docs disagree, stop and flag it. Do not silently pick one.

## Repository layout

```
apps/mobile      Expo app (app/ routes, src/features, src/services, src/stores)
apps/api         Fastify API
apps/worker      yt-dlp worker
packages/shared  Zod schemas and shared types
docs/            these documents
```

## Setup and commands

```bash
pnpm install
pnpm --filter mobile start
pnpm --filter api dev
pnpm lint && pnpm typecheck && pnpm test
```

Run lint, typecheck, and tests before declaring any task done.

## Code style

- TypeScript strict, no untyped `any`
- Feature folders: `src/features/<feature>/{components,hooks,services,store,types}`
- Components are presentational, logic lives in hooks and services
- Theme tokens only, no hard-coded colors or spacing
- Zod validation on every API boundary
- Conventional Commits

## Boundaries

### Always

- Handle loading, empty, error, and offline states on every screen
- Use `FEATURES` flags for flavor differences
- Add a numbered migration for any schema change
- Add unit tests for new logic
- Update the relevant doc when behavior changes

### Ask first

- Adding or upgrading a dependency
- Changing the schema, API contract, or navigation structure
- Anything that touches vault encryption, auth, billing, or the updater
- Changing build profiles, package IDs, or signing config

### Never

- Put extractor or platform-scraping code in the `store` build path
- Commit secrets, keystores, or `.env` files
- Log full URLs, tokens, or vault file names
- Trust the client for entitlements
- Fetch a user-supplied URL on the server without the SSRF guard
- Write decrypted vault content to persistent storage
- Edit an existing migration or force-push to `main`

## Working method

1. Map the task to PRD feature IDs (for example DL-06, VT-02)
2. Read the related docs and existing code
3. Make a short plan, listing files to change
4. Implement in small commits
5. Test, then summarize what changed, what was not done, and any risk to the other flavor or to security

## Pull request checklist

- [ ] Linked PRD IDs
- [ ] Works in both flavors or is correctly disabled in one
- [ ] States handled: loading, empty, error, offline
- [ ] Tests added or updated, CI green
- [ ] No secrets, no sensitive logging
- [ ] Docs updated if behavior changed
- [ ] Screenshots or short recording for UI changes
