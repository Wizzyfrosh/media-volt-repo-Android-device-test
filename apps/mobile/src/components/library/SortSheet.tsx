import { ArrowDown, ArrowUp, Check } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Segmented, Text } from '@/components/ui';
import type { LibrarySort, SortDirection } from '@/stores/app-store';
import { radius, spacing, useTheme } from '@/theme';

export const SORT_LABEL: Record<LibrarySort, string> = {
  name: 'Name',
  date: 'Date added',
  size: 'Size',
};

export interface SortSheetProps {
  sort: LibrarySort;
  direction: SortDirection;
  onChange: (sort: LibrarySort, direction: SortDirection) => void;
  onClose: () => void;
}

const DIRECTIONS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
] as const;

/** Render only while open. */
export function SortSheet({ sort, direction, onChange, onClose }: SortSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const Arrow = direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        accessibilityLabel="Close"
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={() => undefined}
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          <Text variant="heading" accessibilityRole="header">
            Sort by
          </Text>
          {(Object.keys(SORT_LABEL) as LibrarySort[]).map((key) => {
            const selected = key === sort;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onChange(key, key === 'name' ? 'asc' : 'desc')}
                style={styles.row}
              >
                <Text variant="bodyLarge" style={styles.flex}>
                  {SORT_LABEL[key]}
                </Text>
                {selected ? <Arrow color={colors.primary} size={18} /> : null}
                {selected ? <Check color={colors.primary} size={18} /> : null}
              </Pressable>
            );
          })}
          <Segmented options={DIRECTIONS} value={direction} onChange={(d) => onChange(sort, d)} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  flex: { flex: 1 },
});
