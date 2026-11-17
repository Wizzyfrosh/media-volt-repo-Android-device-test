import { StyleSheet, View } from 'react-native';
import { radius, useTheme } from '@/theme';

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  tint?: string;
  height?: number;
}

export function ProgressBar({ value, tint, height = 6 }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, backgroundColor: colors.raised }]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height,
          borderRadius: radius.full,
          backgroundColor: tint ?? colors.primary,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.full, overflow: 'hidden', alignSelf: 'stretch' },
});
