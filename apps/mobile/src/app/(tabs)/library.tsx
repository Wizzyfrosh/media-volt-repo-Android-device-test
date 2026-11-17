import { useRouter } from 'expo-router';
import {
  Archive,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  Music,
  Search,
  Video,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  EmptyState,
  IconButton,
  IconTile,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import { useDemoData } from '@/hooks/use-demo-data';
import { categoryColors, radius, spacing, useTheme, withAlpha, type CategoryKey } from '@/theme';
import type { LucideIcon } from 'lucide-react-native';

const CATEGORIES: { key: CategoryKey; label: string; icon: LucideIcon }[] = [
  { key: 'videos', label: 'Videos', icon: Video },
  { key: 'audio', label: 'Audio', icon: Music },
  { key: 'images', label: 'Images', icon: ImageIcon },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'archives', label: 'Archives', icon: Archive },
  { key: 'other', label: 'Other', icon: LayoutGrid },
];

const FOLDER_TINTS = Object.values(categoryColors);

export default function LibraryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const demo = useDemoData();
  const hasFiles = Object.values(demo.categoryCounts).some((n) => n > 0);

  return (
    <ScreenContainer
      tabScreen
      title="Library"
      right={<IconButton icon={Search} label="Search files" />}
    >
      <View style={styles.tiles}>
        {CATEGORIES.map((c) => (
          <IconTile
            key={c.key}
            icon={c.icon}
            label={c.label}
            tint={categoryColors[c.key]}
            caption={hasFiles ? `${demo.categoryCounts[c.key]} items` : 'Empty'}
          />
        ))}
      </View>

      <Card style={styles.shortcuts}>
        <ListRow
          icon={HardDrive}
          tint={categoryColors.archives}
          title="Storage cleaner"
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
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Folders" />
        {demo.folders.length > 0 ? (
          <View style={styles.folderGrid}>
            {demo.folders.map((f, i) => {
              const tint = FOLDER_TINTS[i % FOLDER_TINTS.length] ?? colors.primary;
              return (
                <Card
                  key={f.id}
                  style={styles.folderCard}
                  accessibilityLabel={`${f.name}, ${f.items} items`}
                  onPress={() =>
                    router.push({ pathname: '/folder/[folderId]', params: { folderId: f.id } })
                  }
                >
                  <View style={[styles.folderIcon, { backgroundColor: withAlpha(tint, 0.18) }]}>
                    <Folder color={tint} size={22} fill={withAlpha(tint, 0.35)} />
                  </View>
                  <Text variant="bodyLarge" numberOfLines={1} style={styles.folderName}>
                    {f.name}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {f.items} items
                  </Text>
                </Card>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="Your library is empty"
            description="Files you download or import will show up here, sorted by type."
            actionLabel="Paste a link"
            onAction={() => router.navigate('/')}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg },
  shortcuts: { paddingVertical: spacing.sm },
  section: { marginTop: spacing.xxl },
  folderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  folderCard: { width: '47.5%', gap: 2 },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderName: { marginTop: spacing.md },
});
