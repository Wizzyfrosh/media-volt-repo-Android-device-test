import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { Text } from './Text';

export interface IconTileProps {
  icon: LucideIcon;
  label: string;
  /** Hex color (#RRGGBB). The tile background is a soft tint of it. */
  tint: string;
  caption?: string;
  onPress?: () => void;
}

/** Soft color-coded tile with a label underneath. Used for file categories. */
export function IconTile({ icon: Icon, label, tint, caption, onPress }: IconTileProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption ? `${label}, ${caption}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.tile, { backgroundColor: withAlpha(tint, 0.16) }]}>
        <Icon color={tint} size={26} strokeWidth={2} />
      </View>
      <Text variant="label" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      {caption ? (
        <Text
          variant="caption"
          tone="tertiary"
          numberOfLines={1}
          style={{ color: colors.textTertiary }}
        >
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4, flexBasis: '33.33%', paddingVertical: spacing.sm },
  tile: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: spacing.xs },
});
