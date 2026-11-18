/**
 * What the download engine needs from the device. The real implementations are in ./adapters
 * (the background-downloader library, expo-network). Tests use fakes.
 */

export type TransportState = 'pending' | 'downloading' | 'paused' | 'done' | 'failed' | 'stopped';

export interface TransportTaskInfo {
  id: string;
  state: TransportState;
  bytesDownloaded: number;
  bytesTotal: number;
}

export interface TransportHandlers {
  onBegin?(expectedBytes: number): void;
  onProgress(p: { bytesDownloaded: number; bytesTotal: number }): void;
  /** `location` is where the finished file is, as a file URI, when it differs from the requested destination. */
  onDone(r: { bytesDownloaded: number; bytesTotal: number; location?: string }): void;
  onError(e: { code: number; message: string }): void;
}

export interface StartRequest {
  id: string;
  url: string;
  /** File URI for the unfinished file. */
  destination: string;
  headers?: Record<string, string>;
  allowCellular: boolean;
  /** Shown in the system notification on Android. */
  title?: string;
}

/** A transfer that keeps running while the app is in the background or closed. */
export interface DownloadTransport {
  start(req: StartRequest, handlers: TransportHandlers): void;
  /** Transfers the system is still running or holding from an earlier session. Call before `attach`. */
  existing(): Promise<TransportTaskInfo[]>;
  /** Reconnects handlers to a transfer found by `existing()`. Returns false if there is none. */
  attach(id: string, handlers: TransportHandlers): boolean;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  /** Stops and forgets a transfer. Does nothing if it is unknown. */
  cancel(id: string): Promise<void>;
  /** Tells the system we have finished handling a transfer, so it can release resources. */
  complete(id: string): void;
  /** Global rule for mobile data. Takes effect for transfers started after the call (and on iOS for new sessions). */
  setAllowCellular(allow: boolean): void;
}

export type NetworkKind = 'wifi' | 'cellular' | 'other' | 'offline';

export interface NetworkPort {
  getKind(): Promise<NetworkKind>;
  subscribe(listener: (kind: NetworkKind) => void): () => void;
}

export interface Scheduler {
  /** Runs `fn` after `ms`. Returns a function that cancels it. */
  after(ms: number, fn: () => void): () => void;
}

export const systemScheduler: Scheduler = {
  after(ms, fn) {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};
