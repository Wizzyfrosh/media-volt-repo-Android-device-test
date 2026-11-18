import { useRouter } from 'expo-router';
import { RotateCcw, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { LibraryItemView } from '@/components/library/LibraryItemView';
import { Button, EmptyState, ScreenContainer, Text } from '@/components/ui';
import type { FileRecord } from '@/db/types';
import type { LibraryItem } from '@/features/library/query';
import { useServices } from '@/services/ServicesProvider';
import { spacing, useTheme } from '@/theme';

export default function TrashScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { files, fileService } = useServices();
  const version = useSyncExternalStore(fileService.subscribe, fileService.getVersion);
  const [trashed, setTrashed] = useState<FileRecord[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void files.list({ trashed: true, sort: 'date', direction: 'desc' }).then((list) => {
      if (cancelled) return;
      setTrashed(list);
      setSelected((s) => new Set([...s].filter((id) => list.some((f) => f.id === id))));
    });
    return () => {
      cancelled = true;
    };
  }, [files, version]);

  const items = useMemo<LibraryItem[]>(
    () => (trashed ?? []).map((file) => ({ kind: 'file', key: `f:${file.id}`, file })),
    [trashed],
  );
  const toggle = (item: LibraryItem) => {
    if (item.kind !== 'file') return;
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(item.file.id)) next.add(item.file.id);
      return next;
    });
  };

  const ids = [...selected];
  const confirmForever = (label: string, run: () => Promise<unknown>) =>
    Alert.alert(label, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: () => void run().then(() => setSelected(new Set())),
      },
    ]);

  return (
    <ScreenContainer
      scroll={false}
      title="Trash"
      subtitle="Items are removed for good after 30 days."
      onBack={() => router.back()}
      right={
        items.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              confirmForever(`Empty Trash (${items.length})?`, () => fileService.emptyTrash())
            }
            hitSlop={10}
          >
            <Text variant="label" tone="danger">
              Empty
            </Text>
          </Pressable>
        ) : null
      }
    >
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        extraData={selected}
        contentContainerStyle={{ paddingBottom: ids.length > 0 ? 110 : spacing.xl }}
        ListEmptyComponent={
          trashed ? (
            <EmptyState
              icon={Trash2}
              title="Trash is empty"
              description="Files you delete wait here for 30 days, so you can bring them back."
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <LibraryItemView
            item={item}
            mode="list"
            tileSize={0}
            selecting
            selected={item.kind === 'file' && selected.has(item.file.id)}
            onPress={toggle}
            onLongPress={toggle}
          />
        )}
      />
      {ids.length > 0 ? (
        <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Button
            label={`Restore ${ids.length}`}
            icon={RotateCcw}
            variant="secondary"
            onPress={() => void fileService.restoreFiles(ids).then(() => setSelected(new Set()))}
            style={styles.flex}
          />
          <Button
            label="Delete forever"
            icon={Trash2}
            variant="danger"
            onPress={() =>
              confirmForever(
                `Delete ${ids.length} ${ids.length === 1 ? 'file' : 'files'} forever?`,
                () => fileService.deleteForever(ids),
              )
            }
            style={styles.flex}
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
