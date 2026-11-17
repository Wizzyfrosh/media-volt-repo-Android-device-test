import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

export interface ErrorStateProps {
  title: string;
  /** Say what went wrong and how to fix it. */
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, retryLabel = 'Try again', onRetry }: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View style={[styles.badge, { backgroundColor: colors.dangerSoft }]}>
        <TriangleAlert color={colors.danger} size={30} strokeWidth={2} />
      </View>
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      <Text tone="secondary" style={styles.center}>
        {message}
      </Text>
      {onRetry ? (
        <Button label={retryLabel} variant="secondary" onPress={onRetry} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  action: { marginTop: spacing.md },
});
