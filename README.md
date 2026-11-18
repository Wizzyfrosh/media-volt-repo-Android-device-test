# MediaVault (working name)

Premium media downloader with a built-in file and document manager and an encrypted vault.
Android and iOS. Two flavors from one codebase: `store` and `direct` (APK).

Start with `docs/PRD.md` and `docs/ARCHITECTURE.md`. Agents: read `AGENTS.md` first.

## Quick start

```bash
corepack enable            # or: npm i -g pnpm
pnpm install
pnpm --filter @mediavault/mobile start:store     # store flavor
pnpm --filter @mediavault/mobile start:direct    # direct flavor
```

Needs a development build (not Expo Go): `eas build --profile dev-store --platform android`
or `pnpm --filter @mediavault/mobile android` with Android Studio installed.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @mediavault/mobile test:variants      # tests in both flavors
pnpm --filter @mediavault/mobile check:store-bundle # proves store build has no extractor code
```

## Status

- Phase 1a done: monorepo, both flavors, theme and UI kit, navigation shell with all screens.
- Phase 1b done: SQLite with migrations, repositories, and the file service (see `docs/STORAGE.md`).
  Settings > Developer tools (development builds) lets you create folders and files and check they survive a restart.
- Phase 1c built: background download engine (queue, pause/resume, retries, Wi-Fi only, recovery after restart). See `docs/DOWNLOADS.md`.
  Unit tested with a fake transport. It still needs the on-device checks listed in that file.
- Phase 1d built: the real Library (folders, filters, search, sort, grid/list, multi-select, move, trash and undo). See `docs/LIBRARY.md`.
- Next: check 1c and 1d on a real phone (see the checklists in `docs/DOWNLOADS.md` and `docs/LIBRARY.md`), then Phase 2 (backend).

Only the Home screen's list of supported sites still uses sample data, and only in development builds (`FEATURES.demoData`).
