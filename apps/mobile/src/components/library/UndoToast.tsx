import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

export interface UndoToastProps {
  message: string;
  actionLabel?: string;
  onAction: () => void;
  onDismiss: () => void;
  /** Distance from the bottom edge, to clear other bars. */
  bottom?: number;
  durationMs?: number;
}

/** A short-lived message with an Undo button. Render it only while it should be visible. */
export function UndoToast({
  message,
  actionLabel = 'Undo',
  onAction,
  onDismiss,
  bottom = spacing.lg,
  durationMs = 6000,
}: UndoToastProps) {
  const { colors } = useTheme();
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs, message]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom, backgroundColor: colors.raised, borderColor: colors.border }]}
    >
      <Text style={styles.msg} numberOfLines={2}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
        <Text variant="label" tone="accent">
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    elevation: 6,
  },
  msg: { flex: 1 },
});
