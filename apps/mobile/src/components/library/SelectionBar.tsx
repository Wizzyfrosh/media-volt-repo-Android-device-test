import { FolderInput, Pencil, Star, Trash2, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

export interface SelectionBarProps {
  /** Exactly one item selected, so renaming makes sense. */
  canRename: boolean;
  /** At least one file selected, so favorite makes sense. */
  canFavorite: boolean;
  allFavorite: boolean;
  onFavorite: () => void;
  onMove: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function Action({
  icon: Icon,
  label,
  onPress,
  danger = false,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      <Icon color={color} size={22} />
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Bulk actions for the selected files and folders. */
export function SelectionBar({
  canRename,
  canFavorite,
  allFavorite,
  onFavorite,
  onMove,
  onRename,
  onDelete,
}: SelectionBarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="toolbar"
    >
      <Action
        icon={Star}
        label={allFavorite ? 'Unfavorite' : 'Favorite'}
        onPress={onFavorite}
        disabled={!canFavorite}
      />
      <Action icon={FolderInput} label="Move" onPress={onMove} />
      <Action icon={Pencil} label="Rename" onPress={onRename} disabled={!canRename} />
      <Action icon={Trash2} label="Delete" onPress={onDelete} danger />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  action: { minWidth: 64, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
