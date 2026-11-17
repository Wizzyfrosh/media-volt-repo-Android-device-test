import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowUp,
  FilePlus,
  Folder as FolderIcon,
  FolderPlus,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import { FEATURES } from '@/config/features';
import { currentSchemaVersion } from '@/db/migrations';
import type { FileRecord, FolderRecord } from '@/db/types';
import { useServices } from '@/services/ServicesProvider';
import { categoryColors, spacing, useTheme } from '@/theme';
import { formatBytes } from '@/utils/format';

interface Snapshot {
  folders: FolderRecord[];
  files: FileRecord[];
  trash: FileRecord[];
  current: FolderRecord | null;
  totals: { folders: number; files: number; trashed: number };
  schema: number;
}

function RowAction({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Star;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={styles.action}
    >
      <Icon color={colors.textSecondary} size={18} />
    </Pressable>
  );
}

/** Developer tools: proves the database and file service work on a real device. Development builds only. */
export default function DebugScreen() {
  const router = useRouter();
  const { db, folders, files, fileService, fs } = useServices();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const current = folderId ? await folders.getById(folderId) : null;
    setSnap({
      current,
      folders: await folders.listChildren(folderId),
      files: await files.list({ folderId, sort: 'name' }),
      trash: await files.list({ trashed: true }),
      totals: {
        folders: await folders.count(),
        files: await files.count(),
        trashed: await files.count(true),
      },
      schema: await currentSchemaVersion(db),
    });
  }, [db, files, folders, folderId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = async (task: () => Promise<unknown>) => {
    try {
      await task();
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    }
    await load();
  };

  if (!FEATURES.demoData) {
    return (
      <ScreenContainer title="Developer tools" onBack={() => router.back()}>
        <EmptyState
          icon={FolderIcon}
          title="Not available"
          description="Developer tools are only in development builds."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Developer tools" onBack={() => router.back()}>
      {snap ? (
        <>
          <Card style={styles.card}>
            <Text variant="label" tone="secondary">
              Database v{snap.schema} · {snap.totals.folders} folders · {snap.totals.files} files ·{' '}
              {snap.totals.trashed} in trash
            </Text>
            <Text variant="caption" tone="secondary">
              Free space {formatBytes(fs.freeSpace())}
            </Text>
            {message ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {message}
              </Text>
            ) : null}
          </Card>

          <View style={styles.buttons}>
            <Button
              label="New folder"
              icon={FolderPlus}
              variant="secondary"
              onPress={() =>
                run(() => fileService.createFolder(`Folder ${snap.totals.folders + 1}`, folderId))
              }
              style={styles.flex}
            />
            <Button
              label="Add file"
              icon={FilePlus}
              onPress={() =>
                run(() =>
                  fileService.createTextFile(
                    `Note ${snap.totals.files + 1}.txt`,
                    `Sample file created ${new Date().toISOString()}`,
                    folderId,
                  ),
                )
              }
              style={styles.flex}
            />
          </View>

          <View style={styles.section}>
            <SectionHeader title={snap.current ? snap.current.name : 'Library'} />
            {snap.current ? (
              <Button
                label="Up one level"
                icon={ArrowUp}
                variant="ghost"
                onPress={() => setFolderId(snap.current?.parentId ?? null)}
              />
            ) : null}
            <Card>
              {snap.folders.map((f) => (
                <ListRow
                  key={f.id}
                  icon={FolderIcon}
                  tint={categoryColors.documents}
                  title={f.name}
                  subtitle="Folder"
                  chevron
                  onPress={() => setFolderId(f.id)}
                  right={
                    <RowAction
                      icon={Trash2}
                      label={`Delete folder ${f.name}`}
                      onPress={() => run(() => fileService.deleteFolder(f.id))}
                    />
                  }
                />
              ))}
              {snap.files.map((f) => (
                <ListRow
                  key={f.id}
                  title={f.name}
                  subtitle={`${f.category} · ${formatBytes(f.sizeBytes)}${f.isFavorite ? ' · favorite' : ''}`}
                  right={
                    <View style={styles.actions}>
                      <RowAction
                        icon={Star}
                        label={`Favorite ${f.name}`}
                        onPress={() => run(() => fileService.toggleFavorite(f.id))}
                      />
                      <RowAction
                        icon={Trash2}
                        label={`Trash ${f.name}`}
                        onPress={() => run(() => fileService.trashFiles([f.id]))}
                      />
                    </View>
                  }
                />
              ))}
              {snap.folders.length === 0 && snap.files.length === 0 ? (
                <Text tone="secondary" style={styles.empty}>
                  Nothing here. Add a folder or a file, then close and reopen the app to check it is
                  still here.
                </Text>
              ) : null}
            </Card>
          </View>

          <View style={styles.section}>
            <SectionHeader
              title="Trash"
              actionLabel={snap.trash.length > 0 ? 'Empty' : undefined}
              onAction={() => run(() => fileService.emptyTrash())}
            />
            <Card>
              {snap.trash.map((f) => (
                <ListRow
                  key={f.id}
                  title={f.name}
                  subtitle={formatBytes(f.sizeBytes)}
                  right={
                    <RowAction
                      icon={RotateCcw}
                      label={`Restore ${f.name}`}
                      onPress={() => run(() => fileService.restoreFiles([f.id]))}
                    />
                  }
                />
              ))}
              {snap.trash.length === 0 ? <Text tone="secondary">Trash is empty.</Text> : null}
            </Card>
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, marginBottom: spacing.lg },
  buttons: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  section: { marginTop: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: spacing.sm },
});
