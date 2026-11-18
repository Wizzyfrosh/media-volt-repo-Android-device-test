import { Check, Pause, Play, RotateCcw, Trash2, X, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { MediaThumb, ProgressBar, Text } from '@/components/ui';
import { describeProgress, displayName, tintFor } from '@/features/downloads/describe';
import type { DownloadView } from '@/features/downloads/engine';
import { spacing, useTheme } from '@/theme';

export interface DownloadActions {
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onOpen: (d: DownloadView) => void;
}

function RowButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.raised },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon color={colors.text} size={18} />
    </Pressable>
  );
}

/** One download with the actions that make sense for its state. Every action is a visible button. */
export function DownloadRow({
  d,
  actions,
  compact = false,
}: {
  d: DownloadView;
  actions?: DownloadActions;
  compact?: boolean;
}) {
  const name = displayName(d);
  const showBar =
    d.status === 'downloading' || d.status === 'paused' || (d.status === 'queued' && d.retries > 0);

  return (
    <View style={styles.row}>
      <MediaThumb tint={tintFor(d)} width={compact ? 64 : 76} height={compact ? 48 : 56} />
      <View style={styles.text}>
        <Text variant="bodyLarge" numberOfLines={1}>
          {name}
        </Text>
        {showBar ? <ProgressBar value={d.progress ?? 0} /> : null}
        <Text
          variant="caption"
          tone={d.status === 'failed' ? 'danger' : 'secondary'}
          numberOfLines={2}
        >
          {describeProgress(d)}
        </Text>
      </View>
      {actions ? (
        <View style={styles.actions}>
          {d.status === 'downloading' ? (
            <RowButton icon={Pause} label={`Pause ${name}`} onPress={() => actions.onPause(d.id)} />
          ) : null}
          {d.status === 'paused' ? (
            <RowButton
              icon={Play}
              label={`Resume ${name}`}
              onPress={() => actions.onResume(d.id)}
            />
          ) : null}
          {d.status === 'failed' ? (
            <RowButton
              icon={RotateCcw}
              label={`Retry ${name}`}
              onPress={() => actions.onRetry(d.id)}
            />
          ) : null}
          {d.status === 'completed' && d.fileId ? (
            <RowButton icon={Check} label={`Open ${name}`} onPress={() => actions.onOpen(d)} />
          ) : null}
          {d.status === 'queued' || d.status === 'downloading' || d.status === 'paused' ? (
            <RowButton icon={X} label={`Cancel ${name}`} onPress={() => actions.onCancel(d.id)} />
          ) : null}
          {d.status === 'completed' || d.status === 'failed' || d.status === 'canceled' ? (
            <RowButton
              icon={Trash2}
              label={`Remove ${name} from the list`}
              onPress={() => actions.onRemove(d.id)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 6 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
