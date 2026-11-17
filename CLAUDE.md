# CLAUDE.md

Context for AI-assisted development (Claude Code and similar tools). Read this first, then the docs in `/docs`.

## Project

MediaVault (working name): React Native (Expo) app for downloading media, managing files and documents, with an encrypted vault. Two build flavors from one codebase (`store`, `direct`). Backend: Fastify + BullMQ + Postgres + yt-dlp workers.

Read before coding: `PRD.md`, `ARCHITECTURE.md`, `SECURITY.md`.

## Commands

```bash
pnpm install
pnpm --filter mobile start            # Expo dev client
pnpm --filter mobile android          # run Android
pnpm --filter mobile test             # unit tests
pnpm --filter api dev                 # API with hot reload
pnpm --filter api test
pnpm lint && pnpm typecheck
APP_VARIANT=direct eas build -p android --profile direct-android
APP_VARIANT=store  eas build -p android --profile store-android
```

## Conventions

- TypeScript strict mode, no `any` without a comment explaining why
- Feature-folder structure: `src/features/<feature>/{components,hooks,services,store,types}`
- UI components are presentational. Logic lives in hooks and services
- Server data through TanStack Query, UI and queue state through Zustand
- All API payloads validated with Zod schemas from `packages/shared`
- Naming: components `PascalCase`, hooks `useThing`, files `kebab-case` except components
- Styling: theme tokens only, no hard-coded colors or spacing in components
- Every screen handles loading, empty, error, and offline states
- Use `FEATURES` flags for flavor differences, never check `APP_VARIANT` inside UI code
- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`)

## Hard rules

1. **Store flavor must not contain extractor code.** Anything platform-extraction related lives in `src/features/extractors/` and is loaded only through `loadExtractors()`.
2. Never log full URLs, tokens, file names from the vault, or personal data.
3. Never store secrets in the app bundle. Tokens go in `expo-secure-store`.
4. Never write vault plaintext to disk outside memory or the temp playback pipeline, and clean temp files on lock.
5. Any server fetch of a user-provided URL must pass through the SSRF guard.
6. Database changes require a numbered migration, never edit an old migration.
7. Do not add dependencies without checking maintenance status, license, and bundle size.
8. Entitlements are decided by the server (or RevenueCat), never trusted from the client.

## Testing expectations

- New logic gets unit tests. New critical flows get a Maestro E2E.
- Run `pnpm lint && pnpm typecheck && pnpm test` before finishing a task.

## Task template

When asked to build a feature:

1. Restate the requirement and map it to PRD IDs (for example DL-06)
2. List files to create or change
3. Implement with tests
4. Note anything affecting the other flavor or security
5. Update the relevant doc if behavior changed

## Glossary

- **Resolve:** turn a user URL into metadata and direct media URLs
- **Flavor:** a build variant (`store` or `direct`)
- **Vault:** encrypted, hidden storage area protected by PIN/biometrics
- **Canary:** scheduled job that tests extraction against known URLs
