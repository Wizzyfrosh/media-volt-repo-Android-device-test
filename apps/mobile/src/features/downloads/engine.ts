import type { DownloadsRepo, DownloadPatch } from '@/db/repositories';
import type { DownloadRecord, DownloadStatus } from '@/db/types';
import type { FileService } from '@/services/file-service';
import { baseName, joinPath } from '@/services/naming';
import type { FileSystemPort } from '@/services/ports';
import {
  backoffDelayMs,
  classifyFailure,
  MAX_RETRIES,
  USER_CANCELED_CODE,
  type FailureCode,
} from './retry';
import {
  type DownloadTransport,
  type NetworkKind,
  type NetworkPort,
  type Scheduler,
  type TransportHandlers,
  type TransportTaskInfo,
  systemScheduler,
} from './ports';
import { assertTransition, isOpen, isTerminal, usesSlot } from './state-machine';

export interface EngineSettings {
  wifiOnly: boolean;
  concurrencyLimit: number;
}

export interface EngineDeps {
  downloads: DownloadsRepo;
  fileService: FileService;
  fs: FileSystemPort;
  transport: DownloadTransport;
  network: NetworkPort;
  scheduler?: Scheduler;
  getSettings: () => EngineSettings;
  now?: () => number;
  /** Called for unexpected internal errors. The engine itself keeps running. */
  onError?: (error: unknown) => void;
}

export interface EnqueueInput {
  url: string;
  directUrl?: string | null;
  title?: string | null;
  /** File name to save as, including the extension. */
  fileName?: string | null;
  folderId?: string | null;
  mime?: string | null;
  expectedBytes?: number | null;
  source?: string | null;
}

/** A download as the UI sees it: the stored record plus live progress. */
export interface DownloadView extends DownloadRecord {
  /** 0..1, or null when the total size is unknown. */
  progress: number | null;
  speedBps: number | null;
  etaSec: number | null;
}

interface Live {
  lastAt: number;
  lastBytes: number;
  speed: number;
  persistedAt: number;
  emittedAt: number;
}

const PERSIST_EVERY_MS = 2_000;
const EMIT_EVERY_MS = 250;

/**
 * Runs the download queue. Rows in SQLite are the source of truth, so a queue survives restarts;
 * the transport (the system's background downloader) does the actual transfer and is reconnected on start.
 */
export class DownloadEngine {
  private readonly records = new Map<string, DownloadRecord>();
  private readonly live = new Map<string, Live>();
  private readonly backoff = new Map<string, () => void>();
  /** Paused transfers the transport still holds, so resuming continues instead of restarting. */
  private readonly resumable = new Set<string>();
  /** Paused by the network rules rather than by the user. */
  private readonly autoPaused = new Set<string>();
  private readonly finalizing = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private readonly scheduler: Scheduler;
  private readonly now: () => number;
  private snapshot: DownloadView[] = [];
  private dirty = true;
  private networkKind: NetworkKind = 'other';
  private unsubscribeNetwork: (() => void) | null = null;
  private pumping = false;
  private pumpAgain = false;

  constructor(private readonly deps: EngineDeps) {
    this.scheduler = deps.scheduler ?? systemScheduler;
    this.now = deps.now ?? Date.now;
  }

  // ---------- lifecycle ----------

  /** Loads the queue, reconnects to transfers that kept running, and starts whatever is waiting. */
  async init(): Promise<void> {
    for (const r of await this.deps.downloads.listAll()) this.records.set(r.id, r);
    this.networkKind = await this.deps.network.getKind().catch((): NetworkKind => 'other');
    this.unsubscribeNetwork = this.deps.network.subscribe((kind) => this.run(this.onNetwork(kind)));
    this.deps.transport.setAllowCellular(!this.deps.getSettings().wifiOnly);
    await this.recover();
    this.emit();
    await this.applyNetworkPolicy();
  }

  dispose(): void {
    this.unsubscribeNetwork?.();
    this.unsubscribeNetwork = null;
    for (const cancel of this.backoff.values()) cancel();
    this.backoff.clear();
  }

  // ---------- reading ----------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Stable between changes, so it can back useSyncExternalStore. */
  getSnapshot = (): DownloadView[] => {
    if (this.dirty) {
      this.snapshot = [...this.records.values()]
        .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1))
        .map((r) => this.view(r));
      this.dirty = false;
    }
    return this.snapshot;
  };

  // ---------- commands ----------

  async enqueue(input: EnqueueInput): Promise<DownloadRecord> {
    const duplicate = [...this.records.values()].find(
      (r) => isOpen(r.status) && r.sourceUrl === input.url,
    );
    if (duplicate) return duplicate;

    const rec = await this.deps.downloads.insert({
      sourceUrl: input.url,
      directUrl: input.directUrl ?? null,
      title: input.title ?? null,
      targetName: input.fileName ?? null,
      folderId: input.folderId ?? null,
      mime: input.mime ?? null,
      source: input.source ?? 'web',
      bytesTotal: input.expectedBytes ?? null,
      status: 'queued',
    });
    this.records.set(rec.id, rec);
    this.emit();
    void this.pump();
    return rec;
  }

  async pause(id: string): Promise<void> {
    const rec = this.records.get(id);
    if (rec?.status !== 'downloading') return;
    const held = await this.deps.transport.pause(id).then(
      () => true,
      () => false,
    );
    if (held) this.resumable.add(id);
    await this.setStatus(id, 'paused');
    void this.pump();
  }

  async resume(id: string): Promise<void> {
    if (this.records.get(id)?.status !== 'paused') return;
    this.autoPaused.delete(id);
    await this.setStatus(id, 'queued', { errorCode: null });
    void this.pump();
  }

  async cancel(id: string): Promise<void> {
    const rec = this.records.get(id);
    if (!rec || isTerminal(rec.status)) return;
    this.clearBackoff(id);
    this.autoPaused.delete(id);
    this.resumable.delete(id);
    this.live.delete(id);
    await this.discardTransfer(id);
    await this.setStatus(id, 'canceled', { errorCode: null });
    void this.pump();
  }

  /** Manual retry of a failed download. Starts again from zero with a fresh retry count. */
  async retry(id: string): Promise<void> {
    if (this.records.get(id)?.status !== 'failed') return;
    await this.setStatus(id, 'queued', { retries: 0, errorCode: null, bytesDone: 0 });
    void this.pump();
  }

  /** Removes a finished, failed or canceled download from the list. The saved file stays in the library. */
  async remove(id: string): Promise<void> {
    const rec = this.records.get(id);
    if (!rec || isOpen(rec.status)) return;
    if (rec.status === 'failed') await this.discardTransfer(id);
    await this.deps.downloads.delete(id);
    this.records.delete(id);
    this.emit();
  }

  async clearFinished(statuses: readonly DownloadStatus[]): Promise<void> {
    for (const r of [...this.records.values()]) {
      if (statuses.includes(r.status)) await this.remove(r.id);
    }
  }

  /** Call when the Wi-Fi-only setting or the concurrency limit changes. */
  async applySettings(): Promise<void> {
    this.deps.transport.setAllowCellular(!this.deps.getSettings().wifiOnly);
    await this.applyNetworkPolicy();
  }

  // ---------- scheduling ----------

  private blocked(): boolean {
    const { wifiOnly } = this.deps.getSettings();
    return this.networkKind === 'offline' || (wifiOnly && this.networkKind === 'cellular');
  }

  /** Starts queued downloads while there are free slots. Runs one pass at a time. */
  private async pump(): Promise<void> {
    if (this.pumping) {
      this.pumpAgain = true;
      return;
    }
    this.pumping = true;
    try {
      do {
        this.pumpAgain = false;
        await this.pumpOnce();
      } while (this.pumpAgain);
    } catch (e) {
      this.deps.onError?.(e);
    } finally {
      this.pumping = false;
    }
  }

  private async pumpOnce(): Promise<void> {
    if (this.blocked()) return;
    const limit = Math.max(1, this.deps.getSettings().concurrencyLimit);
    let active = [...this.records.values()].filter((r) => usesSlot(r.status)).length;

    const waiting = [...this.records.values()]
      .filter((r) => r.status === 'queued' && !this.backoff.has(r.id))
      .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));

    for (const rec of waiting) {
      if (active >= limit) break;
      active++;
      try {
        await this.startDownload(rec.id);
      } catch (e) {
        await this.fail(rec.id, {
          code: null,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  private async startDownload(id: string): Promise<void> {
    const rec = this.records.get(id);
    if (rec?.status !== 'queued') return;

    await this.setStatus(id, 'downloading', { errorCode: null });
    this.live.set(id, {
      lastAt: this.now(),
      lastBytes: rec.bytesDone,
      speed: 0,
      persistedAt: this.now(),
      emittedAt: 0,
    });
    const handlers = this.handlersFor(id);

    if (this.resumable.delete(id)) {
      try {
        await this.deps.transport.resume(id);
        return;
      } catch {
        await this.deps.transport.cancel(id).catch(() => undefined);
        // fall through: start again from zero
      }
    }

    await this.deps.fs.ensureDir(this.deps.fs.downloadsDir());
    await this.deps.fs.remove(this.partPath(id));
    await this.setStatus(id, 'downloading', { bytesDone: 0 });
    this.deps.transport.start(
      {
        id,
        url: rec.directUrl ?? rec.sourceUrl,
        destination: this.partPath(id),
        allowCellular: !this.deps.getSettings().wifiOnly,
        title: rec.targetName ?? rec.title ?? undefined,
      },
      handlers,
    );
  }

  // ---------- transport events ----------

  private handlersFor(id: string): TransportHandlers {
    return {
      onBegin: (expected) => {
        if (expected > 0) this.run(this.patchTotal(id, expected));
      },
      onProgress: (p) => this.run(this.onProgress(id, p)),
      onDone: (r) => this.run(this.finalize(id, r.location)),
      onError: (e) => this.run(this.fail(id, e)),
    };
  }

  private async patchTotal(id: string, total: number): Promise<void> {
    const rec = this.records.get(id);
    if (rec?.status !== 'downloading' || rec.bytesTotal === total) return;
    await this.deps.downloads.update(id, { bytesTotal: total });
    this.records.set(id, { ...rec, bytesTotal: total });
    this.emit();
  }

  private async onProgress(
    id: string,
    p: { bytesDownloaded: number; bytesTotal: number },
  ): Promise<void> {
    const rec = this.records.get(id);
    const live = this.live.get(id);
    if (rec?.status !== 'downloading' || !live) return; // late event after pause or cancel

    const t = this.now();
    const dt = (t - live.lastAt) / 1000;
    if (dt > 0) {
      const instant = Math.max(0, p.bytesDownloaded - live.lastBytes) / dt;
      live.speed = live.speed === 0 ? instant : live.speed * 0.7 + instant * 0.3;
      live.lastAt = t;
      live.lastBytes = p.bytesDownloaded;
    }
    const total = p.bytesTotal > 0 ? p.bytesTotal : rec.bytesTotal;
    this.records.set(id, { ...rec, bytesDone: p.bytesDownloaded, bytesTotal: total });

    if (t - live.persistedAt >= PERSIST_EVERY_MS) {
      live.persistedAt = t;
      await this.deps.downloads.update(id, { bytesDone: p.bytesDownloaded, bytesTotal: total });
    }
    if (t - live.emittedAt >= EMIT_EVERY_MS) {
      live.emittedAt = t;
      this.emit();
    }
  }

  /** The transfer finished: check the file, move it into the library, and mark the download complete. */
  private async finalize(id: string, location?: string): Promise<void> {
    const rec = this.records.get(id);
    if (!rec || this.finalizing.has(id)) return;
    if (rec.status !== 'downloading' && rec.status !== 'verifying') return;
    this.finalizing.add(id);

    try {
      if (rec.status !== 'verifying') await this.setStatus(id, 'verifying');
      const fs = this.deps.fs;
      const part = this.partPath(id);
      const source = (await fs.exists(part))
        ? part
        : location && (await fs.exists(location))
          ? location
          : null;
      if (!source)
        return await this.fail(
          id,
          { code: null, message: 'file missing after download' },
          'INCOMPLETE',
        );

      const size = await fs.sizeOf(source);
      const expected = rec.bytesTotal ?? 0;
      if (size === 0 || (expected > 0 && size < expected)) {
        await fs.remove(source);
        return await this.fail(id, { code: null, message: 'incomplete file' }, 'INCOMPLETE');
      }

      let fileId: string;
      try {
        const file = await this.deps.fileService.importFile({
          sourcePath: source,
          name: rec.targetName ?? rec.title ?? baseName(rec.sourceUrl),
          folderId: rec.folderId,
          source: rec.source ?? 'web',
          mime: rec.mime,
        });
        fileId = file.id;
      } catch (e) {
        this.deps.onError?.(e);
        return await this.failForGood(id, 'IMPORT_FAILED');
      }

      this.live.delete(id);
      await this.setStatus(id, 'completed', {
        fileId,
        bytesDone: size,
        bytesTotal: size,
        errorCode: null,
      });
      this.deps.transport.complete(id);
    } finally {
      this.finalizing.delete(id);
      void this.pump();
    }
  }

  /** A transfer failed. Retry with a growing delay, or give up if it is not worth retrying. */
  private async fail(
    id: string,
    error: { code: number | null; message: string },
    forced?: FailureCode,
  ): Promise<void> {
    const rec = this.records.get(id);
    if (!rec || (rec.status !== 'downloading' && rec.status !== 'verifying')) return; // stale event

    if (error.code === USER_CANCELED_CODE) {
      await this.cancel(id); // the Cancel button on the system notification
      return;
    }

    const verdict = forced ? { code: forced, retryable: true } : classifyFailure(error);
    this.live.delete(id);
    await this.discardTransfer(id);

    if (verdict.retryable && rec.retries < MAX_RETRIES) {
      await this.setStatus(id, 'queued', {
        retries: rec.retries + 1,
        errorCode: verdict.code,
        bytesDone: 0,
      });
      const wait = backoffDelayMs(rec.retries);
      this.clearBackoff(id);
      this.backoff.set(
        id,
        this.scheduler.after(wait, () => {
          this.backoff.delete(id);
          void this.pump();
        }),
      );
    } else {
      await this.setStatus(id, 'failed', { errorCode: verdict.code });
    }
    void this.pump();
  }

  private async failForGood(id: string, code: FailureCode): Promise<void> {
    this.live.delete(id);
    await this.setStatus(id, 'failed', { errorCode: code });
    this.deps.transport.complete(id);
  }

  // ---------- network rules ----------

  private async onNetwork(kind: NetworkKind): Promise<void> {
    this.networkKind = kind;
    await this.applyNetworkPolicy();
  }

  /** Pauses active downloads when the connection is not allowed, and resumes them when it is. */
  private async applyNetworkPolicy(): Promise<void> {
    if (this.blocked()) {
      const reason = this.networkKind === 'offline' ? 'WAITING_FOR_NETWORK' : 'WAITING_FOR_WIFI';
      for (const rec of [...this.records.values()]) {
        if (rec.status !== 'downloading') continue;
        const held = await this.deps.transport.pause(rec.id).then(
          () => true,
          () => false,
        );
        if (held) this.resumable.add(rec.id);
        this.autoPaused.add(rec.id);
        await this.setStatus(rec.id, 'paused', { errorCode: reason });
      }
    } else {
      for (const id of [...this.autoPaused]) {
        this.autoPaused.delete(id);
        if (this.records.get(id)?.status === 'paused')
          await this.setStatus(id, 'queued', { errorCode: null });
      }
    }
    await this.pump();
  }

  // ---------- recovery after the app was closed ----------

  private async recover(): Promise<void> {
    const found = new Map<string, TransportTaskInfo>(
      (await this.deps.transport.existing().catch((): TransportTaskInfo[] => [])).map((t) => [
        t.id,
        t,
      ]),
    );

    for (const rec of [...this.records.values()]) {
      if (!isOpen(rec.status)) continue;
      const task = found.get(rec.id);
      found.delete(rec.id);

      if (rec.status === 'queued') {
        if (task) await this.discardTransfer(rec.id);
      } else if (rec.status === 'paused') {
        if (rec.errorCode?.startsWith('WAITING_FOR_')) this.autoPaused.add(rec.id);
        if (
          task?.state === 'paused' &&
          this.deps.transport.attach(rec.id, this.handlersFor(rec.id))
        ) {
          this.resumable.add(rec.id);
        } else if (task) {
          await this.discardTransfer(rec.id);
        }
      } else {
        await this.recoverRunning(rec, task);
      }
    }
    // Transfers the system still holds that we no longer track.
    for (const id of found.keys()) await this.discardTransfer(id, false);
  }

  private async recoverRunning(
    rec: DownloadRecord,
    task: TransportTaskInfo | undefined,
  ): Promise<void> {
    const id = rec.id;
    if (task?.state === 'done') {
      await this.finalize(id);
      return;
    }
    if (
      (task?.state === 'downloading' || task?.state === 'pending') &&
      this.deps.transport.attach(id, this.handlersFor(id))
    ) {
      this.live.set(id, {
        lastAt: this.now(),
        lastBytes: task.bytesDownloaded,
        speed: 0,
        persistedAt: this.now(),
        emittedAt: 0,
      });
      if (rec.status !== 'downloading') await this.setStatus(id, 'downloading');
      return;
    }
    if (task?.state === 'paused' && this.deps.transport.attach(id, this.handlersFor(id))) {
      this.resumable.add(id);
      await this.setStatus(id, 'paused');
      return;
    }
    if (task) await this.discardTransfer(id, false);

    // The system no longer has it. Maybe it finished while we were closed.
    const part = this.partPath(id);
    if (await this.looksComplete(rec, part)) {
      await this.finalize(id);
      return;
    }
    await this.deps.fs.remove(part).catch(() => undefined);
    await this.setStatus(id, 'queued', { bytesDone: 0 });
  }

  private async looksComplete(rec: DownloadRecord, part: string): Promise<boolean> {
    if (!(await this.deps.fs.exists(part))) return false;
    const size = await this.deps.fs.sizeOf(part);
    if (size <= 0) return false;
    if (rec.status === 'verifying') return true;
    return (rec.bytesTotal ?? 0) > 0 && size >= (rec.bytesTotal ?? 0);
  }

  // ---------- helpers ----------

  private partPath(id: string): string {
    return joinPath(this.deps.fs.downloadsDir(), `${id}.part`);
  }

  /** Stops the system transfer and deletes the unfinished file. */
  private async discardTransfer(id: string, removePart = true): Promise<void> {
    await this.deps.transport.cancel(id).catch(() => undefined);
    this.deps.transport.complete(id);
    if (removePart) await this.deps.fs.remove(this.partPath(id)).catch(() => undefined);
  }

  private clearBackoff(id: string): void {
    this.backoff.get(id)?.();
    this.backoff.delete(id);
  }

  private async setStatus(
    id: string,
    status: DownloadStatus,
    extra: DownloadPatch = {},
  ): Promise<void> {
    const rec = this.records.get(id);
    if (!rec) throw new Error(`Unknown download ${id}`);
    if (rec.status !== status) assertTransition(rec.status, status);
    await this.deps.downloads.update(id, { status, ...extra });
    this.records.set(id, { ...rec, ...extra, status, updatedAt: this.now() });
    this.emit();
  }

  private view(r: DownloadRecord): DownloadView {
    const live = this.live.get(r.id);
    const total = r.bytesTotal ?? 0;
    const progress = total > 0 ? Math.min(1, r.bytesDone / total) : null;
    const speed = r.status === 'downloading' && live && live.speed > 0 ? live.speed : null;
    const etaSec =
      speed && total > 0 ? Math.max(0, Math.round((total - r.bytesDone) / speed)) : null;
    return { ...r, progress, speedBps: speed, etaSec };
  }

  private emit(): void {
    this.dirty = true;
    for (const l of this.listeners) l();
  }

  private run(p: Promise<unknown>): void {
    p.catch((e: unknown) => this.deps.onError?.(e));
  }
}
