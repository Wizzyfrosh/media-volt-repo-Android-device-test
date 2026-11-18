import { useRouter } from 'expo-router';
import { HardDrive } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  EmptyState,
  ProgressBar,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import type { FileCategory } from '@/db/types';
import { useServices } from '@/services/ServicesProvider';
import { categoryColors, spacing } from '@/theme';
import { formatBytes } from '@/utils/format';

const LABELS: Record<FileCategory, string> = {
  videos: 'Videos',
  images: 'Images',
  audio: 'Audio',
  documents: 'Documents',
  archives: 'Archives',
  other: 'Other',
};

interface Usage {
  bySize: Record<FileCategory, number>;
  byCount: Record<FileCategory, number>;
}

export default function StorageScreen() {
  const router = useRouter();
  const { files, fileService, fs } = useServices();
  const version = useSyncExternalStore(fileService.subscribe, fileService.getVersion);
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([files.sizeByCategory(), files.countByCategory()]).then(
      ([bySize, byCount]) => {
        if (!cancelled) setUsage({ bySize, byCount });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [files, version]);

  const keys = Object.keys(LABELS) as CategoryKeyList;
  const total = usage ? keys.reduce((sum, k) => sum + usage.bySize[k], 0) : 0;
  const count = usage ? keys.reduce((sum, k) => sum + usage.byCount[k], 0) : 0;

  return (
    <ScreenContainer title="Storage" onBack={() => router.back()}>
      {usage && count > 0 ? (
        <>
          <Card style={styles.summary}>
            <View style={styles.stat}>
              <Text variant="label" tone="secondary">
                MediaVault is using
              </Text>
              <Text variant="title">{formatBytes(total)}</Text>
              <Text variant="caption" tone="secondary">
                {count} {count === 1 ? 'file' : 'files'}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text variant="label" tone="secondary">
                Free on this phone
              </Text>
              <Text variant="title">{formatBytes(fs.freeSpace())}</Text>
            </View>
          </Card>

          <View style={styles.section}>
            <SectionHeader title="By type" />
            <Card style={styles.breakdown}>
              {keys
                .filter((k) => usage.byCount[k] > 0)
                .sort((a, b) => usage.bySize[b] - usage.bySize[a])
                .map((k) => (
                  <View key={k} style={styles.line}>
                    <View style={styles.lineHead}>
                      <Text variant="body">
                        {LABELS[k]} ({usage.byCount[k]})
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {formatBytes(usage.bySize[k])}
                      </Text>
                    </View>
                    <ProgressBar
                      value={total > 0 ? usage.bySize[k] / total : 0}
                      tint={categoryColors[k]}
                    />
                  </View>
                ))}
            </Card>
          </View>
        </>
      ) : (
        <EmptyState
          icon={HardDrive}
          title="Nothing to show yet"
          description="Storage details appear once you have saved files."
        />
      )}
    </ScreenContainer>
  );
}

type CategoryKeyList = FileCategory[];

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: spacing.xl },
  stat: { flex: 1, gap: 2 },
  section: { marginTop: spacing.xxl },
  breakdown: { gap: spacing.lg },
  line: { gap: 8 },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between' },
});
