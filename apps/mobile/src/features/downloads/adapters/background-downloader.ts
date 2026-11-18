import {
  completeHandler,
  createDownloadTask,
  getExistingDownloadTasks,
  setConfig,
  type DownloadTask,
} from '@kesha-antonov/react-native-background-downloader';
import { PermissionsAndroid, Platform } from 'react-native';
import type {
  DownloadTransport,
  TransportHandlers,
  TransportState,
  TransportTaskInfo,
} from '../ports';

const toUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

const STATE: Record<DownloadTask['state'], TransportState> = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  DONE: 'done',
  FAILED: 'failed',
  STOPPED: 'stopped',
};

/**
 * DownloadTransport backed by @kesha-antonov/react-native-background-downloader:
 * NSURLSession background sessions on iOS, DownloadManager plus a foreground service on Android.
 * Transfers keep running when the app is in the background and can be found again after a restart.
 */
export function createBackgroundTransport(): DownloadTransport {
  const tasks = new Map<string, DownloadTask>();

  setConfig({
    progressInterval: 500,
    progressMinBytes: 64 * 1024,
    showNotificationsEnabled: true,
    showCompletionNotification: true,
    showCancelAction: true,
    isLogsEnabled: false,
  });

  const bind = (task: DownloadTask, h: TransportHandlers) => {
    task
      .begin(({ expectedBytes }) => h.onBegin?.(expectedBytes))
      .progress(({ bytesDownloaded, bytesTotal }) => h.onProgress({ bytesDownloaded, bytesTotal }))
      .done(({ bytesDownloaded, bytesTotal, location }) =>
        h.onDone({ bytesDownloaded, bytesTotal, location: location ? toUri(location) : undefined }),
      )
      .error(({ error, errorCode }) => h.onError({ code: errorCode, message: error }));
  };

  return {
    start(req, handlers) {
      const task = createDownloadTask({
        id: req.id,
        url: req.url,
        destination: req.destination,
        headers: req.headers,
        isAllowedOverMetered: req.allowCellular,
        isAllowedOverRoaming: req.allowCellular,
        notificationTitle: req.title,
        metadata: { title: req.title },
      });
      bind(task, handlers);
      tasks.set(req.id, task);
      task.start();
    },

    async existing() {
      const found = await getExistingDownloadTasks();
      found.forEach((t) => tasks.set(t.id, t));
      return found.map((t): TransportTaskInfo => ({
        id: t.id,
        state: STATE[t.state] ?? 'failed',
        bytesDownloaded: t.bytesDownloaded,
        bytesTotal: t.bytesTotal,
      }));
    },

    attach(id, handlers) {
      const task = tasks.get(id);
      if (!task) return false;
      bind(task, handlers);
      return true;
    },

    async pause(id) {
      const task = tasks.get(id);
      if (!task) throw new Error('No such transfer');
      await task.pause();
    },

    async resume(id) {
      const task = tasks.get(id);
      if (!task) throw new Error('No such transfer');
      await task.resume();
    },

    async cancel(id) {
      const task = tasks.get(id);
      tasks.delete(id);
      await task?.stop();
    },

    complete(id) {
      tasks.delete(id);
      completeHandler(id);
    },

    setAllowCellular(allow) {
      setConfig({ allowsCellularAccess: allow });
    },
  };
}

/**
 * Android 13+ needs the user's OK to show the download notification (progress and Cancel button).
 * Asked in context, the first time the user starts a download. Downloads still work if it is refused.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  const permission = 'android.permission.POST_NOTIFICATIONS' as const;
  if (await PermissionsAndroid.check(permission)) return true;
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}
