import { createRepositories } from '@/db/repositories';
import { DownloadEngine, type EngineSettings } from '@/features/downloads/engine';
import { FileService } from '@/services/file-service';
import type { NetworkKind } from '@/features/downloads/ports';
import { createMemoryFs } from './memory-fs';
import { FakeNetwork, FakeScheduler, FakeTransport } from './fake-transport';
import { createMigratedDb } from './test-db';

export const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

export async function makeHarness(
  opts: {
    limit?: number;
    wifiOnly?: boolean;
    network?: NetworkKind;
    db?: Awaited<ReturnType<typeof createMigratedDb>>;
  } = {},
) {
  const clock = { t: 1_800_000_000_000 };
  const now = () => clock.t;
  const db = opts.db ?? (await createMigratedDb());
  const repos = createRepositories(db, () => ++clock.t);
  const fs = createMemoryFs();
  const fileService = new FileService({ repos, fs, now });
  const transport = new FakeTransport(fs);
  const network = new FakeNetwork();
  network.kind = opts.network ?? 'wifi';
  const scheduler = new FakeScheduler();
  const settings: EngineSettings = {
    wifiOnly: opts.wifiOnly ?? false,
    concurrencyLimit: opts.limit ?? 1,
  };
  const errors: unknown[] = [];

  const build = () =>
    new DownloadEngine({
      downloads: repos.downloads,
      fileService,
      fs,
      transport,
      network,
      scheduler,
      getSettings: () => settings,
      now,
      onError: (e) => errors.push(e),
    });

  const engine = build();
  await engine.init();

  return {
    engine,
    build,
    transport,
    network,
    scheduler,
    repos,
    fs,
    fileService,
    settings,
    clock,
    errors,
    db,
  };
}

export type Harness = Awaited<ReturnType<typeof makeHarness>>;

export const byId = (h: Harness, id: string) => h.engine.getSnapshot().find((d) => d.id === id)!;
