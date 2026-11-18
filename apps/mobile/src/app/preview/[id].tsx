import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ErrorState, MediaThumb, Sheet, Skeleton, Text } from '@/components/ui';
import { FEATURES } from '@/config/features';
import { tintFor } from '@/features/downloads/describe';
import { inspectLink, LinkInspectError, type LinkInfo } from '@/features/downloads/inspect-link';
import { ensureNotificationPermission } from '@/features/downloads/adapters/background-downloader';
import { useServices } from '@/services/ServicesProvider';
import { radius, spacing, useTheme } from '@/theme';
import { formatBytes } from '@/utils/format';
import { parseHttpUrl } from '@/utils/url';

type State =
  | { phase: 'checking' }
  | { phase: 'ready'; info: LinkInfo }
  | { phase: 'webpage' }
  | { phase: 'error'; title: string; message: string };

function describeError(e: unknown): { title: string; message: string } {
  if (e instanceof LinkInspectError) {
    switch (e.code) {
      case 'INVALID_URL':
        return { title: 'Not a web link', message: 'Check the link and try again.' };
      case 'TIMEOUT':
        return {
          title: 'The site is not answering',
          message: 'It took too long. Check your connection and try again.',
        };
      case 'HTTP':
        return e.status === 404 || e.status === 410
          ? {
              title: 'File not found',
              message: 'This link no longer works. It may have expired or been removed.',
            }
          : {
              title: 'The site refused the request',
              message:
                `It answered with error ${e.status ?? ''}. The link may need you to be signed in.`.replace(
                  '  ',
                  ' ',
                ),
            };
      default:
        return {
          title: 'Could not reach this link',
          message:
            'Check your connection. If the link starts with http://, try the https:// version.',
        };
    }
  }
  return { title: 'Something went wrong', message: 'Try again in a moment.' };
}

export default function PreviewSheet() {
  const router = useRouter();
  const { colors } = useTheme();
  const { downloadEngine } = useServices();
  const { url } = useLocalSearchParams<{ id: string; url?: string }>();
  const host = parseHttpUrl(url)?.host ?? 'this link';
  const [state, setState] = useState<State>({ phase: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    inspectLink(url)
      .then((info) => {
        if (!cancelled)
          setState(info.kind === 'webpage' ? { phase: 'webpage' } : { phase: 'ready', info });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ phase: 'error', ...describeError(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  const retry = useCallback(() => {
    setState({ phase: 'checking' });
    setAttempt((n) => n + 1);
  }, []);

  const start = async (info: LinkInfo) => {
    setStarting(true);
    try {
      await ensureNotificationPermission(); // asked once, here, in context
      await downloadEngine.enqueue({
        url: info.url,
        directUrl: info.finalUrl,
        fileName: info.fileName,
        mime: info.mime,
        expectedBytes: info.sizeBytes,
        title: info.fileName,
      });
      router.back();
      router.push('/queue');
    } finally {
      setStarting(false);
    }
  };

  if (!url) {
    return (
      <Sheet>
        <ErrorState
          title="No link"
          message="Paste a link on the Home tab first."
          retryLabel="Close"
          onRetry={() => router.back()}
        />
      </Sheet>
    );
  }

  return (
    <Sheet>
      {state.phase === 'checking' ? (
        <View style={styles.gap}>
          <Text variant="heading" style={styles.center}>
            Checking {host}
          </Text>
          <View style={styles.row}>
            <Skeleton width={88} height={64} borderRadius={radius.md} />
            <View style={styles.flex}>
              <Skeleton height={18} />
              <Skeleton width="60%" height={14} style={styles.mt} />
            </View>
          </View>
          <Skeleton height={56} borderRadius={radius.md} />
        </View>
      ) : null}

      {state.phase === 'error' ? (
        <ErrorState
          title={state.title}
          message={state.message}
          retryLabel="Try again"
          onRetry={retry}
        />
      ) : null}

      {state.phase === 'webpage' ? (
        <ErrorState
          title="This is a web page, not a file"
          message={
            FEATURES.socialExtraction
              ? 'Saving videos from sites like this arrives in the next update. For now, paste a direct link to a file.'
              : 'Paste a direct link to a video, audio file or document, not the address of a web page.'
          }
          retryLabel="Close"
          onRetry={() => router.back()}
        />
      ) : null}

      {state.phase === 'ready' ? (
        <>
          <Text variant="heading" style={styles.center}>
            File found
          </Text>
          <View style={styles.row}>
            <MediaThumb
              tint={tintFor({
                mime: state.info.mime,
                targetName: state.info.fileName,
                title: null,
                sourceUrl: state.info.url,
              })}
            />
            <View style={styles.flex}>
              <Text variant="bodyLarge" numberOfLines={2}>
                {state.info.fileName}
              </Text>
              <Text variant="caption" tone="secondary">
                {host}
              </Text>
            </View>
          </View>

          <View
            accessibilityRole="radio"
            accessibilityState={{ selected: true }}
            style={[styles.option, { backgroundColor: colors.raised, borderColor: colors.primary }]}
          >
            <View style={styles.flex}>
              <Text variant="bodyLarge">Original file</Text>
              <Text variant="caption" tone="secondary">
                {[
                  state.info.mime,
                  state.info.sizeBytes ? formatBytes(state.info.sizeBytes) : 'Size unknown',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <View
              style={[
                styles.check,
                { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Check color={colors.onPrimary} size={14} strokeWidth={3} />
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => router.back()}
              style={styles.flex}
            />
            <Button
              label="Download"
              loading={starting}
              onPress={() => void start(state.info)}
              style={styles.flex}
            />
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.lg },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: 'auto' },
});
