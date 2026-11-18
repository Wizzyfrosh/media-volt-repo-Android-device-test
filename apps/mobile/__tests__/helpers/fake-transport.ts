import type {
  DownloadTransport,
  NetworkKind,
  NetworkPort,
  Scheduler,
  StartRequest,
  TransportHandlers,
  TransportState,
  TransportTaskInfo,
} from '@/features/downloads/ports';
import type { MemoryFs } from './memory-fs';

interface FakeTask {
  req: StartRequest;
  handlers: TransportHandlers;
  state: TransportState;
  bytes: number;
  total: number;
}

/** A stand-in for the system's background downloader that tests drive by hand. */
export class FakeTransport implements DownloadTransport {
  tasks = new Map<string, FakeTask>();
  started: StartRequest[] = [];
  paused: string[] = [];
  resumed: string[] = [];
  canceled: string[] = [];
  completed: string[] = [];
  allowCellular = true;
  /** Transfers "from an earlier session", returned by existing(). */
  leftovers: TransportTaskInfo[] = [];
  failPause = false;
  failResume = false;

  constructor(private readonly fs: MemoryFs) {}

  start(req: StartRequest, handlers: TransportHandlers): void {
    this.started.push(req);
    this.tasks.set(req.id, { req, handlers, state: 'downloading', bytes: 0, total: 0 });
  }

  async existing(): Promise<TransportTaskInfo[]> {
    return this.leftovers;
  }

  attach(id: string, handlers: TransportHandlers): boolean {
    const info = this.leftovers.find((t) => t.id === id);
    if (!info) return false;
    this.tasks.set(id, {
      req: { id, url: '', destination: '', allowCellular: true },
      handlers,
      state: info.state,
      bytes: info.bytesDownloaded,
      total: info.bytesTotal,
    });
    return true;
  }

  async pause(id: string): Promise<void> {
    if (this.failPause || !this.tasks.has(id)) throw new Error('cannot pause');
    this.paused.push(id);
    this.tasks.get(id)!.state = 'paused';
  }

  async resume(id: string): Promise<void> {
    if (this.failResume || !this.tasks.has(id)) throw new Error('cannot resume');
    this.resumed.push(id);
    this.tasks.get(id)!.state = 'downloading';
  }

  async cancel(id: string): Promise<void> {
    this.canceled.push(id);
    this.tasks.delete(id);
  }

  complete(id: string): void {
    this.completed.push(id);
  }

  setAllowCellular(allow: boolean): void {
    this.allowCellular = allow;
  }

  // ----- test drivers -----
  begin(id: string, expected: number) {
    this.tasks.get(id)!.total = expected;
    this.tasks.get(id)!.handlers.onBegin?.(expected);
  }

  progress(id: string, bytesDownloaded: number, bytesTotal: number) {
    this.tasks.get(id)!.handlers.onProgress({ bytesDownloaded, bytesTotal });
  }

  /** Writes the finished file to the fake disk and reports success. */
  finish(id: string, size: number) {
    const t = this.tasks.get(id)!;
    this.fs.seed(t.req.destination, size);
    t.state = 'done';
    t.handlers.onDone({ bytesDownloaded: size, bytesTotal: size });
  }

  fail(id: string, code: number, message: string) {
    this.tasks.get(id)!.handlers.onError({ code, message });
  }

  isRunning(id: string) {
    return this.tasks.get(id)?.state === 'downloading';
  }
}

export class FakeNetwork implements NetworkPort {
  kind: NetworkKind = 'wifi';
  private listener: ((k: NetworkKind) => void) | null = null;
  async getKind() {
    return this.kind;
  }
  subscribe(listener: (k: NetworkKind) => void) {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  change(kind: NetworkKind) {
    this.kind = kind;
    this.listener?.(kind);
  }
}

/** Timers that only fire when the test says so. */
export class FakeScheduler implements Scheduler {
  pending: { ms: number; fn: () => void; canceled: boolean }[] = [];
  after(ms: number, fn: () => void) {
    const entry = { ms, fn, canceled: false };
    this.pending.push(entry);
    return () => {
      entry.canceled = true;
    };
  }
  delays() {
    return this.pending.filter((p) => !p.canceled).map((p) => p.ms);
  }
  /** Fires the oldest live timer. */
  fireNext() {
    const next = this.pending.find((p) => !p.canceled);
    if (!next) throw new Error('no timer pending');
    next.canceled = true;
    next.fn();
  }
}
