import { byId, flush, makeHarness, type Harness } from './helpers/engine-harness';

const url = 'https://example.com/big.mp4';

/** Simulates the app being killed: the old engine is gone, a new one starts on the same database and disk. */
async function restart(h: Harness) {
  h.engine.dispose();
  h.transport.tasks.clear();
  h.transport.started = [];
  h.transport.resumed = [];
  h.transport.canceled = [];
  const engine = h.build();
  await engine.init();
  await flush();
  return engine;
}

async function startOne(h: Harness, total = 1000) {
  const d = await h.engine.enqueue({ url, fileName: 'big.mp4' });
  await flush();
  h.transport.begin(d.id, total);
  await flush();
  return d;
}

describe('recovery after the app was closed', () => {
  it('reconnects to a transfer the system kept running, and finishes it', async () => {
    const h = await makeHarness();
    const d = await startOne(h);
    h.transport.leftovers = [
      { id: d.id, state: 'downloading', bytesDownloaded: 600, bytesTotal: 1000 },
    ];

    const engine = await restart(h);
    expect(engine.getSnapshot().find((x) => x.id === d.id)!.status).toBe('downloading');
    expect(h.transport.started).toHaveLength(0); // reattached, not restarted

    h.fs.seed(`/data/downloads/${d.id}.part`, 1000);
    h.transport.tasks.get(d.id)!.handlers.onDone({ bytesDownloaded: 1000, bytesTotal: 1000 });
    await flush();
    expect(engine.getSnapshot().find((x) => x.id === d.id)!.status).toBe('completed');
    expect(await h.repos.files.count()).toBe(1);
  });

  it('imports a download that finished while the app was closed', async () => {
    const h = await makeHarness();
    const d = await startOne(h);
    h.fs.seed(`/data/downloads/${d.id}.part`, 1000);
    h.transport.leftovers = [{ id: d.id, state: 'done', bytesDownloaded: 1000, bytesTotal: 1000 }];

    const engine = await restart(h);
    const v = engine.getSnapshot().find((x) => x.id === d.id)!;
    expect(v.status).toBe('completed');
    expect((await h.repos.files.getById(v.fileId!))!.name).toBe('big.mp4');
    expect(h.transport.started).toHaveLength(0);
  });

  it('restarts a download the system no longer has (for example after a reboot)', async () => {
    const h = await makeHarness();
    const d = await startOne(h);
    h.fs.seed(`/data/downloads/${d.id}.part`, 300); // partial leftovers

    const engine = await restart(h);
    expect(h.transport.started.map((r) => r.id)).toEqual([d.id]);
    expect(engine.getSnapshot().find((x) => x.id === d.id)!.status).toBe('downloading');
    expect(h.fs.files.get(`/data/downloads/${d.id}.part`)).toBeUndefined(); // stale partial file was cleared
  });

  it('imports a complete file even if the system forgot the transfer', async () => {
    const h = await makeHarness();
    const d = await startOne(h, 1000);
    h.fs.seed(`/data/downloads/${d.id}.part`, 1000);

    const engine = await restart(h);
    expect(engine.getSnapshot().find((x) => x.id === d.id)!.status).toBe('completed');
    expect(h.transport.started).toHaveLength(0);
  });

  it('keeps a paused transfer resumable', async () => {
    const h = await makeHarness();
    const d = await startOne(h);
    await h.engine.pause(d.id);
    h.transport.leftovers = [{ id: d.id, state: 'paused', bytesDownloaded: 400, bytesTotal: 1000 }];

    const engine = await restart(h);
    expect(engine.getSnapshot().find((x) => x.id === d.id)!.status).toBe('paused');
    await engine.resume(d.id);
    await flush();
    expect(h.transport.resumed).toEqual([d.id]);
    expect(h.transport.started).toHaveLength(0);
  });

  it('starts over when a paused transfer is gone', async () => {
    const h = await makeHarness();
    const d = await startOne(h);
    await h.engine.pause(d.id);

    const engine = await restart(h);
    await engine.resume(d.id);
    await flush();
    expect(h.transport.resumed).toEqual([]);
    expect(h.transport.started.map((r) => r.id)).toEqual([d.id]);
  });

  it('cancels transfers the system holds that we do not know about', async () => {
    const h = await makeHarness();
    h.transport.leftovers = [
      { id: 'ghost', state: 'downloading', bytesDownloaded: 1, bytesTotal: 2 },
    ];
    await restart(h);
    expect(h.transport.canceled).toContain('ghost');
  });

  it('finishes a download that was being verified when the app closed', async () => {
    const h = await makeHarness();
    const d = await startOne(h);
    await h.repos.downloads.update(d.id, { status: 'verifying' });
    h.fs.seed(`/data/downloads/${d.id}.part`, 1000);

    const engine = await restart(h);
    expect(engine.getSnapshot().find((x) => x.id === d.id)!.status).toBe('completed');
  });

  it('starts queued downloads on launch', async () => {
    const h = await makeHarness({ limit: 1 });
    const a = await h.engine.enqueue({ url: 'https://example.com/a.mp4', fileName: 'a.mp4' });
    const b = await h.engine.enqueue({ url: 'https://example.com/b.mp4', fileName: 'b.mp4' });
    await flush();
    const engine = await restart(h);
    const status = (id: string) => engine.getSnapshot().find((x) => x.id === id)!.status;
    expect([status(a.id), status(b.id)]).toEqual(['downloading', 'queued']);
  });

  it('remembers downloads that were waiting for Wi-Fi and resumes them when it is back', async () => {
    const h = await makeHarness({ wifiOnly: true, network: 'wifi' });
    const d = await startOne(h);
    h.network.change('cellular');
    await flush();
    expect(byId(h, d.id).status).toBe('paused');
    h.transport.leftovers = [{ id: d.id, state: 'paused', bytesDownloaded: 10, bytesTotal: 1000 }];

    h.network.kind = 'wifi';
    const engine = await restart(h);
    expect(engine.getSnapshot().find((x) => x.id === d.id)!.status).toBe('downloading');
    expect(h.transport.resumed).toEqual([d.id]);
  });

  it('keeps finished and failed history across restarts', async () => {
    const h = await makeHarness();
    const ok = await h.engine.enqueue({ url: 'https://example.com/ok.mp4', fileName: 'ok.mp4' });
    await flush();
    h.transport.finish(ok.id, 10);
    await flush();
    const bad = await h.engine.enqueue({ url: 'https://example.com/bad.mp4', fileName: 'bad.mp4' });
    await flush();
    h.transport.fail(bad.id, 404, 'nope');
    await flush();

    const engine = await restart(h);
    const status = (id: string) => engine.getSnapshot().find((x) => x.id === id)!.status;
    expect([status(ok.id), status(bad.id)]).toEqual(['completed', 'failed']);
  });
});
