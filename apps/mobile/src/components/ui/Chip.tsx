import { Pressable, StyleSheet } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.raised,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text variant="label" tone={selected ? 'onPrimary' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
