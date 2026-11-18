import { Folder, Library } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/ui';
import { flattenFolderTree, type FolderOption } from '@/features/library/folder-tree';
import { useServices } from '@/services/ServicesProvider';
import { categoryColors, radius, spacing, useTheme } from '@/theme';

export interface FolderPickerProps {
  title?: string;
  /** Folders (and everything inside them) that cannot be chosen, such as the ones being moved. */
  exclude?: ReadonlySet<string>;
  onPick: (folderId: string | null) => void;
  onClose: () => void;
}

/** Choose a destination folder, or the top of the library. Render it only while it is open. */
export function FolderPickerModal({
  title = 'Move to',
  exclude,
  onPick,
  onClose,
}: FolderPickerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { folders } = useServices();
  const [options, setOptions] = useState<FolderOption[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void folders.listAll().then((all) => {
      if (!cancelled) setOptions(flattenFolderTree(all, exclude));
    });
    return () => {
      cancelled = true;
    };
  }, [folders, exclude]);

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
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          <FlatList
            data={options ?? []}
            keyExtractor={(o) => o.folder.id}
            style={styles.list}
            ListHeaderComponent={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Library, top level"
                onPress={() => onPick(null)}
                style={styles.row}
              >
                <Library color={colors.primary} size={20} />
                <Text variant="bodyLarge">Library (top level)</Text>
              </Pressable>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.folder.name}
                onPress={() => onPick(item.folder.id)}
                style={[styles.row, { paddingLeft: spacing.sm + item.depth * 20 }]}
              >
                <Folder color={categoryColors.documents} size={20} />
                <Text variant="bodyLarge" numberOfLines={1} style={styles.flex}>
                  {item.folder.name}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text tone="secondary" style={styles.hint}>
                {options
                  ? 'No other folders yet. Create one from the Library screen first.'
                  : 'Loading folders'}
              </Text>
            }
          />
          <Button label="Cancel" variant="secondary" onPress={onClose} fullWidth />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  flex: { flex: 1 },
  hint: { paddingVertical: spacing.md },
});
