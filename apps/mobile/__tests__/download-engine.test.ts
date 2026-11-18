import { MAX_RETRIES } from '@/features/downloads/retry';
import { byId, flush, makeHarness, type Harness } from './helpers/engine-harness';

const url = (n: number) => `https://example.com/file${n}.mp4`;
let h: Harness;

describe('queue and concurrency', () => {
  it('starts a download straight away and writes to a .part file', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1), fileName: 'Clip.mp4' });
    await flush();
    expect(h.transport.started).toHaveLength(1);
    expect(h.transport.started[0]).toMatchObject({
      id: d.id,
      url: url(1),
      allowCellular: true,
      title: 'Clip.mp4',
    });
    expect(h.transport.started[0]!.destination).toBe(`/data/downloads/${d.id}.part`);
    expect(byId(h, d.id).status).toBe('downloading');
  });

  it('runs one at a time for free users and starts the next when one finishes', async () => {
    h = await makeHarness({ limit: 1 });
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    const b = await h.engine.enqueue({ url: url(2), fileName: 'b.mp4' });
    await flush();
    expect(byId(h, a.id).status).toBe('downloading');
    expect(byId(h, b.id).status).toBe('queued');

    h.transport.finish(a.id, 500);
    await flush();
    expect(byId(h, a.id).status).toBe('completed');
    expect(byId(h, b.id).status).toBe('downloading');
  });

  it('honors a higher limit and keeps the order of arrival', async () => {
    h = await makeHarness({ limit: 2 });
    const ids = [];
    for (let i = 1; i <= 4; i++)
      ids.push((await h.engine.enqueue({ url: url(i), fileName: `f${i}.mp4` })).id);
    await flush();
    expect(h.transport.started.map((r) => r.id)).toEqual([ids[0], ids[1]]);
    h.transport.finish(ids[0]!, 10);
    await flush();
    expect(h.transport.started.map((r) => r.id)).toEqual([ids[0], ids[1], ids[2]]);
  });

  it('does not queue the same link twice while it is still open', async () => {
    h = await makeHarness();
    const a = await h.engine.enqueue({ url: url(1) });
    const b = await h.engine.enqueue({ url: url(1) });
    expect(b.id).toBe(a.id);
    expect(h.engine.getSnapshot()).toHaveLength(1);
  });

  it('notifies subscribers when something changes', async () => {
    h = await makeHarness();
    const calls: number[] = [];
    h.engine.subscribe(() => calls.push(1));
    await h.engine.enqueue({ url: url(1) });
    await flush();
    expect(calls.length).toBeGreaterThan(0);
  });
});

describe('progress', () => {
  it('shows progress, speed and time left, and persists it less often than it arrives', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.begin(d.id, 1000);
    await flush();
    expect(byId(h, d.id).bytesTotal).toBe(1000);

    h.clock.t += 1000;
    h.transport.progress(d.id, 100, 1000);
    await flush();
    h.clock.t += 1000;
    h.transport.progress(d.id, 300, 1000);
    await flush();

    const v = byId(h, d.id);
    expect(v.progress).toBeCloseTo(0.3);
    expect(v.speedBps).toBeGreaterThan(0);
    expect(v.etaSec).toBeGreaterThan(0);
    // second progress event was >2s after the start, so it was written to the database
    expect((await h.repos.downloads.getById(d.id))!.bytesDone).toBe(300);

    h.clock.t += 100;
    h.transport.progress(d.id, 350, 1000);
    await flush();
    expect(byId(h, d.id).bytesDone).toBe(300); // screen refreshes at most every 250 ms

    h.clock.t += 300;
    h.transport.progress(d.id, 400, 1000);
    await flush();
    expect(byId(h, d.id).bytesDone).toBe(400); // now visible
    expect((await h.repos.downloads.getById(d.id))!.bytesDone).toBe(300); // still not written to disk
  });

  it('reports unknown progress when the size is unknown', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1) });
    await flush();
    h.transport.progress(d.id, 50, 0);
    await flush();
    expect(byId(h, d.id).progress).toBeNull();
  });
});

describe('completing', () => {
  it('moves the file into the library and links it to the download', async () => {
    h = await makeHarness();
    const folder = await h.fileService.createFolder('Trips');
    const d = await h.engine.enqueue({
      url: url(1),
      fileName: 'Holiday.mp4',
      folderId: folder.id,
      source: 'web',
      mime: 'video/mp4',
    });
    await flush();
    h.transport.begin(d.id, 2048);
    h.transport.finish(d.id, 2048);
    await flush();

    const v = byId(h, d.id);
    expect(v.status).toBe('completed');
    expect(v.fileId).toBeTruthy();
    const file = (await h.repos.files.getById(v.fileId!))!;
    expect(file).toMatchObject({
      name: 'Holiday.mp4',
      folderId: folder.id,
      sizeBytes: 2048,
      category: 'videos',
      source: 'web',
    });
    expect(h.fs.files.has(`/data/downloads/${d.id}.part`)).toBe(false);
    expect(h.fs.files.has(file.path)).toBe(true);
    expect(h.transport.completed).toContain(d.id);
  });

  it('uses the link name when no file name was given', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: 'https://example.com/path/My%20Song.mp3' });
    await flush();
    h.transport.finish(d.id, 40);
    await flush();
    expect((await h.repos.files.getById(byId(h, d.id).fileId!))!.name).toBe('My Song.mp3');
  });

  it('treats a file smaller than announced as incomplete and retries', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4', expectedBytes: 1000 });
    await flush();
    h.transport.finish(d.id, 400);
    await flush();
    expect(byId(h, d.id)).toMatchObject({ status: 'queued', retries: 1, errorCode: 'INCOMPLETE' });
    expect(h.fs.files.has(`/data/downloads/${d.id}.part`)).toBe(false);
  });

  it('fails for good, and keeps going, when the library refuses the file', async () => {
    h = await makeHarness();
    jest.spyOn(h.fileService, 'importFile').mockRejectedValueOnce(new Error('db locked'));
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.finish(d.id, 100);
    await flush();
    expect(byId(h, d.id)).toMatchObject({ status: 'failed', errorCode: 'IMPORT_FAILED' });
    expect(h.errors).toHaveLength(1);
  });

  it('ignores a second done event for the same download', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.finish(d.id, 100);
    h.transport.finish(d.id, 100);
    await flush();
    expect(await h.repos.files.count()).toBe(1);
  });
});

describe('pause, resume, cancel', () => {
  it('pausing frees the slot for the next download', async () => {
    h = await makeHarness({ limit: 1 });
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    const b = await h.engine.enqueue({ url: url(2), fileName: 'b.mp4' });
    await flush();
    await h.engine.pause(a.id);
    await flush();
    expect(byId(h, a.id).status).toBe('paused');
    expect(byId(h, b.id).status).toBe('downloading');
  });

  it('resuming continues the same transfer instead of restarting it', async () => {
    h = await makeHarness({ limit: 1 });
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    await h.engine.pause(a.id);
    await h.engine.resume(a.id);
    await flush();
    expect(h.transport.resumed).toEqual([a.id]);
    expect(h.transport.started).toHaveLength(1);
    expect(byId(h, a.id).status).toBe('downloading');
  });

  it('restarts from zero when the system lost the paused transfer', async () => {
    h = await makeHarness({ limit: 1 });
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.failPause = true;
    await h.engine.pause(a.id);
    h.transport.failPause = false;
    await h.engine.resume(a.id);
    await flush();
    expect(h.transport.resumed).toEqual([]);
    expect(h.transport.started).toHaveLength(2);
  });

  it('a resumed download waits its turn when the slots are taken', async () => {
    h = await makeHarness({ limit: 1 });
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    const b = await h.engine.enqueue({ url: url(2), fileName: 'b.mp4' });
    await flush();
    await h.engine.pause(a.id);
    await flush(); // b is now running
    await h.engine.resume(a.id);
    await flush();
    expect(byId(h, a.id).status).toBe('queued');
    h.transport.finish(b.id, 10);
    await flush();
    expect(byId(h, a.id).status).toBe('downloading');
  });

  it('canceling stops the transfer, deletes the partial file and starts the next', async () => {
    h = await makeHarness({ limit: 1 });
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    const b = await h.engine.enqueue({ url: url(2), fileName: 'b.mp4' });
    await flush();
    h.fs.seed(`/data/downloads/${a.id}.part`, 50);
    await h.engine.cancel(a.id);
    await flush();
    expect(byId(h, a.id).status).toBe('canceled');
    expect(h.transport.canceled).toContain(a.id);
    expect(h.fs.files.has(`/data/downloads/${a.id}.part`)).toBe(false);
    expect(byId(h, b.id).status).toBe('downloading');
  });

  it('ignores progress and errors that arrive after a cancel', async () => {
    h = await makeHarness();
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    const handlers = h.transport.tasks.get(a.id)!.handlers;
    await h.engine.cancel(a.id);
    handlers.onProgress({ bytesDownloaded: 10, bytesTotal: 100 });
    handlers.onError({ code: 500, message: 'late' });
    handlers.onDone({ bytesDownloaded: 100, bytesTotal: 100 });
    await flush();
    expect(byId(h, a.id).status).toBe('canceled');
    expect(h.errors).toEqual([]);
  });

  it('treats the notification Cancel button (code -1) as a cancel, not a failure', async () => {
    h = await makeHarness();
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.fail(a.id, -1, 'canceled');
    await flush();
    expect(byId(h, a.id).status).toBe('canceled');
  });

  it('removes finished items from the list but keeps the saved file', async () => {
    h = await makeHarness();
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.finish(a.id, 10);
    await flush();
    await h.engine.remove(a.id);
    expect(h.engine.getSnapshot()).toHaveLength(0);
    expect(await h.repos.downloads.getById(a.id)).toBeNull();
    expect(await h.repos.files.count()).toBe(1);
  });

  it('will not remove a download that is still running', async () => {
    h = await makeHarness();
    const a = await h.engine.enqueue({ url: url(1) });
    await flush();
    await h.engine.remove(a.id);
    expect(h.engine.getSnapshot()).toHaveLength(1);
  });
});

describe('failures and retries', () => {
  it('retries a network error with growing delays, then gives up after three retries', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();

    const delays: number[] = [];
    for (let i = 0; i < MAX_RETRIES; i++) {
      h.transport.fail(d.id, -1005, 'The network connection was lost.');
      await flush();
      expect(byId(h, d.id)).toMatchObject({
        status: 'queued',
        retries: i + 1,
        errorCode: 'NETWORK',
      });
      delays.push(...h.scheduler.delays());
      h.scheduler.fireNext();
      await flush();
      expect(byId(h, d.id).status).toBe('downloading');
    }
    expect(delays).toEqual([2000, 4000, 8000]);

    h.transport.fail(d.id, -1005, 'The network connection was lost.');
    await flush();
    expect(byId(h, d.id)).toMatchObject({ status: 'failed', errorCode: 'NETWORK' });
  });

  it('does not start a retry before its delay has passed', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.fail(d.id, 503, 'unavailable');
    await flush();
    expect(h.transport.started).toHaveLength(1);
    h.scheduler.fireNext();
    await flush();
    expect(h.transport.started).toHaveLength(2);
  });

  it('fails straight away when retrying would not help', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.fail(d.id, 404, 'Not found');
    await flush();
    expect(byId(h, d.id)).toMatchObject({ status: 'failed', errorCode: 'NOT_FOUND', retries: 0 });
    expect(h.scheduler.delays()).toEqual([]);
  });

  it('a failed download frees its slot', async () => {
    h = await makeHarness({ limit: 1 });
    const a = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    const b = await h.engine.enqueue({ url: url(2), fileName: 'b.mp4' });
    await flush();
    h.transport.fail(a.id, 410, 'gone');
    await flush();
    expect(byId(h, b.id).status).toBe('downloading');
  });

  it('manual retry starts again from zero with a fresh count', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.fail(d.id, 404, 'Not found');
    await flush();
    await h.engine.retry(d.id);
    await flush();
    expect(byId(h, d.id)).toMatchObject({ status: 'downloading', retries: 0, errorCode: null });
    expect(h.transport.started).toHaveLength(2);
  });

  it('canceling during a retry wait stops the timer', async () => {
    h = await makeHarness();
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.transport.fail(d.id, 503, 'x');
    await flush();
    await h.engine.cancel(d.id);
    expect(h.scheduler.delays()).toEqual([]);
    expect(byId(h, d.id).status).toBe('canceled');
  });
});

describe('Wi-Fi only and connectivity', () => {
  it('does not start on mobile data when Wi-Fi only is on, then starts on Wi-Fi', async () => {
    h = await makeHarness({ wifiOnly: true, network: 'cellular' });
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    expect(h.transport.started).toHaveLength(0);
    expect(byId(h, d.id).status).toBe('queued');
    h.network.change('wifi');
    await flush();
    expect(byId(h, d.id).status).toBe('downloading');
    expect(h.transport.allowCellular).toBe(false);
  });

  it('pauses a running download when Wi-Fi drops, and resumes it when Wi-Fi returns', async () => {
    h = await makeHarness({ wifiOnly: true, network: 'wifi' });
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.network.change('cellular');
    await flush();
    expect(byId(h, d.id)).toMatchObject({ status: 'paused', errorCode: 'WAITING_FOR_WIFI' });

    h.network.change('wifi');
    await flush();
    expect(byId(h, d.id)).toMatchObject({ status: 'downloading', errorCode: null });
    expect(h.transport.resumed).toEqual([d.id]);
    expect(h.transport.started).toHaveLength(1);
  });

  it('mobile data is fine when Wi-Fi only is off', async () => {
    h = await makeHarness({ wifiOnly: false, network: 'cellular' });
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    expect(byId(h, d.id).status).toBe('downloading');
  });

  it('waits while offline and continues when the connection returns', async () => {
    h = await makeHarness({ network: 'wifi' });
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.network.change('offline');
    await flush();
    expect(byId(h, d.id)).toMatchObject({ status: 'paused', errorCode: 'WAITING_FOR_NETWORK' });
    h.network.change('other');
    await flush();
    expect(byId(h, d.id).status).toBe('downloading');
  });

  it('does not auto-resume something the user paused', async () => {
    h = await makeHarness({ wifiOnly: true });
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    await h.engine.pause(d.id);
    h.network.change('cellular');
    await flush();
    h.network.change('wifi');
    await flush();
    expect(byId(h, d.id).status).toBe('paused');
  });

  it('applies a changed Wi-Fi-only setting straight away', async () => {
    h = await makeHarness({ wifiOnly: false, network: 'cellular' });
    const d = await h.engine.enqueue({ url: url(1), fileName: 'a.mp4' });
    await flush();
    h.settings.wifiOnly = true;
    await h.engine.applySettings();
    await flush();
    expect(byId(h, d.id).status).toBe('paused');
    expect(h.transport.allowCellular).toBe(false);
  });
});
