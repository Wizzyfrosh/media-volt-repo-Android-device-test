import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Text } from './Text';

export interface ListRowProps {
  icon?: LucideIcon;
  /** Hex color (#RRGGBB) for the leading icon tile. Defaults to the primary accent. */
  tint?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  /** Show a chevron when the row navigates somewhere. */
  chevron?: boolean;
}

export function ListRow({
  icon: Icon,
  tint,
  title,
  subtitle,
  right,
  onPress,
  chevron,
}: ListRowProps) {
  const { colors } = useTheme();
  const color = tint ?? colors.primary;
  const body = (
    <View style={styles.row}>
      {Icon ? (
        <View
          style={[
            styles.icon,
            { backgroundColor: tint ? withAlpha(tint, 0.16) : colors.primarySoft },
          ]}
        >
          <Icon color={color} size={20} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="bodyLarge" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <ChevronRight color={colors.textTertiary} size={20} /> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
