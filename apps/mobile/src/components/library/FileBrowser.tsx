import { useRouter } from 'expo-router';
import {
  Archive,
  ArrowUpDown,
  FileText,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  LayoutList,
  Lock,
  Music,
  Search,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Card,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  IconTile,
  ListRow,
  ScreenContainer,
  Skeleton,
  Text,
} from '@/components/ui';
import type { FileCategory } from '@/db/types';
import {
  buildItems,
  type LibraryFilter,
  type LibraryItem,
  type LibraryQuery,
} from '@/features/library/query';
import {
  EMPTY_SELECTION,
  isItemSelected,
  isSelecting,
  pruneSelection,
  selectAll,
  selectionCount,
  toggleItem,
} from '@/features/library/selection';
import { useDebounced } from '@/hooks/use-debounced';
import { useLibrary } from '@/hooks/use-library';
import { useServices } from '@/services/ServicesProvider';
import { useAppStore } from '@/stores/app-store';
import { categoryColors, radius, spacing, useTheme } from '@/theme';
import { FolderPickerModal } from './FolderPickerModal';
import { LibraryItemView } from './LibraryItemView';
import { PromptModal } from './PromptModal';
import { SelectionBar } from './SelectionBar';
import { SORT_LABEL, SortSheet } from './SortSheet';
import { UndoToast } from './UndoToast';

const FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'videos', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'images', label: 'Images' },
  { value: 'documents', label: 'Documents' },
  { value: 'archives', label: 'Archives' },
  { value: 'other', label: 'Other' },
];

const TILES: { key: FileCategory; label: string; icon: LucideIcon }[] = [
  { key: 'videos', label: 'Videos', icon: Video },
  { key: 'audio', label: 'Audio', icon: Music },
  { key: 'images', label: 'Images', icon: ImageIcon },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'archives', label: 'Archives', icon: Archive },
  { key: 'other', label: 'Other', icon: FolderOpen },
];

export interface FileBrowserProps {
  /** Folder to browse. Null is the top of the library. */
  folderId: string | null;
  title: string;
  onBack?: () => void;
  /** Search box, filter chips and category tiles. Shown on the Library tab, hidden inside a folder. */
  showFilters?: boolean;
  tabScreen?: boolean;
}

function countsText(items: readonly LibraryItem[], flat: boolean): string {
  const folders = items.filter((i) => i.kind === 'folder').length;
  const files = items.length - folders;
  if (flat) return `${files} ${files === 1 ? 'file' : 'files'}`;
  return [
    folders > 0 ? `${folders} ${folders === 1 ? 'folder' : 'folders'}` : null,
    files > 0 ? `${files} ${files === 1 ? 'file' : 'files'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function FileBrowser({
  folderId,
  title,
  onBack,
  showFilters = false,
  tabScreen = false,
}: FileBrowserProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { fileService } = useServices();
  const view = useAppStore((s) => s.libraryView);
  const sort = useAppStore((s) => s.librarySort);
  const direction = useAppStore((s) => s.libraryDirection);
  const setView = useAppStore((s) => s.setLibraryView);
  const setSort = useAppStore((s) => s.setLibrarySort);

  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const search = useDebounced(searchText, 200);

  const query = useMemo<LibraryQuery>(
    () => ({
      folderId,
      filter: showFilters ? filter : 'all',
      search: showFilters ? search : '',
      sort,
      direction,
    }),
    [folderId, filter, search, sort, direction, showFilters],
  );
  const state = useLibrary(query);
  const data = state.data;
  const items = useMemo(() => (data ? buildItems(data) : []), [data]);

  const [rawSelection, setSelection] = useState(EMPTY_SELECTION);
  // Ticks for items that disappeared (deleted, moved away) are dropped automatically.
  const selection = useMemo(() => pruneSelection(rawSelection, items), [rawSelection, items]);
  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  const selecting = isSelecting(selection);

  const [sortOpen, setSortOpen] = useState(false);
  const [movePicker, setMovePicker] = useState(false);
  const [prompt, setPrompt] = useState<
    null | { kind: 'new-folder' } | { kind: 'rename'; item: LibraryItem }
  >(null);
  const [undo, setUndo] = useState<{ ids: string[]; message: string } | null>(null);

  // The Android back button leaves selection mode before it leaves the screen.
  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelection(EMPTY_SELECTION);
      return true;
    });
    return () => sub.remove();
  }, [selecting]);

  const columns = view === 'grid' ? 3 : 1;
  const gap = spacing.md;
  const tileSize = Math.floor((width - spacing.xl * 2 - gap * (columns - 1)) / columns);

  const run = useCallback(async (task: () => Promise<unknown>) => {
    try {
      await task();
    } catch (e) {
      Alert.alert('Could not finish', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, []);

  const open = useCallback(
    (item: LibraryItem) => {
      if (item.kind === 'folder') {
        router.push({ pathname: '/folder/[folderId]', params: { folderId: item.folder.id } });
        return;
      }
      const media = item.file.category === 'videos' || item.file.category === 'audio';
      router.push({
        pathname: media ? '/player/[fileId]' : '/viewer/[fileId]',
        params: { fileId: item.file.id },
      });
    },
    [router],
  );
  const onItemPress = useCallback(
    (item: LibraryItem) => {
      if (isSelecting(selectionRef.current)) setSelection((s) => toggleItem(s, item));
      else open(item);
    },
    [open],
  );
  const onItemLongPress = useCallback(
    (item: LibraryItem) => setSelection((s) => toggleItem(s, item)),
    [],
  );

  const selectedItems = items.filter((i) => isItemSelected(selection, i));
  const selectedFiles = selectedItems.flatMap((i) => (i.kind === 'file' ? [i.file] : []));
  const allFavorite = selectedFiles.length > 0 && selectedFiles.every((f) => f.isFavorite);

  const excludeFromMove = useMemo(() => new Set(selection.folders), [selection.folders]);

  const doTrash = async () => {
    const fileIds = [...selection.files];
    const folderIds = [...selection.folders];
    await run(async () => {
      if (fileIds.length > 0) await fileService.trashFiles(fileIds);
      for (const id of folderIds) await fileService.deleteFolder(id);
      setSelection(EMPTY_SELECTION);
      if (folderIds.length === 0) {
        setUndo({
          ids: fileIds,
          message: `Moved ${fileIds.length} ${fileIds.length === 1 ? 'file' : 'files'} to Trash`,
        });
      }
    });
  };

  const onDelete = () => {
    const folderCount = selection.folders.size;
    if (folderCount === 0) {
      void doTrash();
      return;
    }
    Alert.alert(
      `Delete ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}?`,
      'Files inside go to Trash, where you can restore them for 30 days. The folders themselves are removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void doTrash() },
      ],
    );
  };

  const onMovePick = (dest: string | null) => {
    setMovePicker(false);
    const files = [...selection.files];
    const folders = [...selection.folders];
    void run(async () => {
      if (files.length > 0) await fileService.moveFiles(files, dest);
      for (const id of folders) await fileService.moveFolder(id, dest);
      setSelection(EMPTY_SELECTION);
    });
  };

  const clearFilters = () => {
    setFilter('all');
    setSearchText('');
    setSearchOpen(false);
  };

  // ---------- pieces ----------

  const showHeader =
    showFilters &&
    data !== null &&
    !data.flat &&
    folderId === null &&
    !selecting &&
    (data.totalFiles > 0 || data.folders.length > 0);

  const header = showHeader ? (
    <View style={styles.header}>
      <View style={styles.tiles}>
        {TILES.map((t) => (
          <IconTile
            key={t.key}
            icon={t.icon}
            label={t.label}
            tint={categoryColors[t.key]}
            caption={`${data?.categoryCounts[t.key] ?? 0} items`}
            onPress={() => setFilter(t.key)}
          />
        ))}
      </View>
      <Card style={styles.shortcuts}>
        <ListRow
          icon={HardDrive}
          tint={categoryColors.archives}
          title="Storage"
          subtitle="See what is using space"
          chevron
          onPress={() => router.push('/storage')}
        />
        <ListRow
          icon={Lock}
          tint={categoryColors.audio}
          title="Private vault"
          subtitle="Lock files behind your PIN or fingerprint"
          chevron
          onPress={() => router.navigate('/vault')}
        />
        <ListRow
          icon={Trash2}
          tint={categoryColors.images}
          title="Trash"
          subtitle={
            data && data.trashedCount > 0
              ? `${data.trashedCount} ${data.trashedCount === 1 ? 'item' : 'items'}, removed after 30 days`
              : 'Empty'
          }
          chevron
          onPress={() => router.push('/trash')}
        />
      </Card>
    </View>
  ) : null;

  const empty = (() => {
    if (!data) return null;
    if (data.flat) {
      return (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Nothing fits this search or filter. Try something else."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      );
    }
    if (folderId === null) {
      return (
        <EmptyState
          icon={FolderOpen}
          title="Your library is empty"
          description="Files you download or import will show up here, sorted by type."
          actionLabel="Paste a link"
          onAction={() => router.navigate('/')}
        />
      );
    }
    return (
      <EmptyState
        icon={FolderOpen}
        title="This folder is empty"
        description="Move files here from the Library to keep them together."
      />
    );
  })();

  const loading = state.status === 'loading' && !data;
  const failed = state.status === 'error' && !data;

  const right = selecting ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => setSelection(selectAll(items))}
      hitSlop={10}
    >
      <Text variant="label" tone="accent">
        Select all
      </Text>
    </Pressable>
  ) : (
    <View style={styles.headerActions}>
      {showFilters ? (
        <IconButton
          icon={searchOpen ? X : Search}
          label={searchOpen ? 'Close search' : 'Search files'}
          onPress={() => {
            if (searchOpen) setSearchText('');
            setSearchOpen((o) => !o);
          }}
        />
      ) : null}
      <IconButton
        icon={FolderPlus}
        label="New folder"
        onPress={() => setPrompt({ kind: 'new-folder' })}
      />
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenContainer
        scroll={false}
        tabScreen={tabScreen}
        title={selecting ? `${selectionCount(selection)} selected` : title}
        onBack={selecting ? () => setSelection(EMPTY_SELECTION) : onBack}
        right={right}
      >
        {showFilters && !selecting ? (
          <View style={styles.controls}>
            {searchOpen || searchText ? (
              <View
                style={[
                  styles.search,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Search color={colors.textSecondary} size={18} />
                <TextInput
                  autoFocus={searchOpen && searchText === ''}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search all files"
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Search all files"
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {searchText ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => setSearchText('')}
                    hitSlop={10}
                  >
                    <X color={colors.textSecondary} size={18} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {FILTERS.map((f) => (
                <Chip
                  key={f.value}
                  label={f.label}
                  selected={filter === f.value}
                  onPress={() => setFilter(f.value)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {!selecting ? (
          <View style={styles.toolbar}>
            <Text variant="caption" tone="secondary" style={styles.count}>
              {data ? countsText(items, data.flat) : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${SORT_LABEL[sort]}`}
              onPress={() => setSortOpen(true)}
              style={styles.toolBtn}
              hitSlop={6}
            >
              <ArrowUpDown color={colors.textSecondary} size={16} />
              <Text variant="label" tone="secondary">
                {SORT_LABEL[sort]}
              </Text>
            </Pressable>
            <IconButton
              icon={view === 'grid' ? LayoutList : LayoutGrid}
              label={view === 'grid' ? 'Show as list' : 'Show as grid'}
              onPress={() => setView(view === 'grid' ? 'list' : 'grid')}
            />
          </View>
        ) : null}

        {loading ? (
          <View style={styles.skeletons} accessibilityLabel="Loading your files">
            {Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width={48} height={48} borderRadius={radius.sm} />
                <View style={styles.flex}>
                  <Skeleton height={16} width="70%" />
                  <Skeleton height={12} width="40%" style={styles.skeletonGap} />
                </View>
              </View>
            ))}
          </View>
        ) : failed ? (
          <ErrorState
            title="Could not load your files"
            message={state.error ?? 'Try again.'}
            onRetry={state.reload}
          />
        ) : (
          <FlatList
            key={view}
            data={items}
            extraData={selection}
            keyExtractor={(i) => i.key}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? { gap, marginBottom: gap } : undefined}
            ListHeaderComponent={header ?? undefined}
            ListEmptyComponent={empty ?? undefined}
            contentContainerStyle={{ paddingBottom: selecting ? 110 : spacing.xl }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={18}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={({ item }) => (
              <LibraryItemView
                item={item}
                mode={view}
                tileSize={tileSize}
                selected={isItemSelected(selection, item)}
                selecting={selecting}
                onPress={onItemPress}
                onLongPress={onItemLongPress}
              />
            )}
          />
        )}
      </ScreenContainer>

      {selecting ? (
        <SelectionBar
          canRename={selectionCount(selection) === 1}
          canFavorite={selectedFiles.length > 0}
          allFavorite={allFavorite}
          onFavorite={() =>
            void run(() =>
              fileService.setFavorite(
                selectedFiles.map((f) => f.id),
                !allFavorite,
              ),
            )
          }
          onMove={() => setMovePicker(true)}
          onRename={() => {
            const only = selectedItems[0];
            if (only) setPrompt({ kind: 'rename', item: only });
          }}
          onDelete={onDelete}
        />
      ) : null}

      {undo ? (
        <UndoToast
          message={undo.message}
          onDismiss={() => setUndo(null)}
          onAction={() => {
            const ids = undo.ids;
            setUndo(null);
            void run(() => fileService.restoreFiles(ids));
          }}
        />
      ) : null}

      {sortOpen ? (
        <SortSheet
          sort={sort}
          direction={direction}
          onChange={setSort}
          onClose={() => setSortOpen(false)}
        />
      ) : null}
      {movePicker ? (
        <FolderPickerModal
          exclude={excludeFromMove}
          onPick={onMovePick}
          onClose={() => setMovePicker(false)}
        />
      ) : null}

      {prompt?.kind === 'new-folder' ? (
        <PromptModal
          title="New folder"
          placeholder="Folder name"
          confirmLabel="Create"
          onClose={() => setPrompt(null)}
          onSubmit={async (name) => {
            await fileService.createFolder(name, folderId);
          }}
        />
      ) : null}
      {prompt?.kind === 'rename' ? (
        <PromptModal
          title="Rename"
          initialValue={
            prompt.item.kind === 'file' ? prompt.item.file.name : prompt.item.folder.name
          }
          onClose={() => setPrompt(null)}
          onSubmit={async (name) => {
            if (prompt.item.kind === 'file')
              await fileService.renameFile(prompt.item.file.id, name);
            else await fileService.renameFolder(prompt.item.folder.id, name);
            setSelection(EMPTY_SELECTION);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { marginBottom: spacing.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  shortcuts: { paddingVertical: spacing.sm },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  controls: { gap: spacing.md, marginBottom: spacing.sm },
  chips: { gap: spacing.sm, paddingRight: spacing.xl },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 46,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  searchInput: { flex: 1, fontSize: 16, minHeight: 44 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  count: { flex: 1 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  skeletons: { gap: spacing.lg, marginTop: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonGap: { marginTop: 6 },
});
