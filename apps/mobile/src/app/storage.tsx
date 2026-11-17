import { useRouter } from 'expo-router';
import { HardDrive } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  EmptyState,
  ProgressBar,
  ProgressRing,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import { useDemoData } from '@/hooks/use-demo-data';
import { categoryColors, spacing, type CategoryKey } from '@/theme';
import { formatBytes } from '@/utils/format';

const LABELS: Record<CategoryKey, string> = {
  videos: 'Videos',
  images: 'Images',
  audio: 'Audio',
  documents: 'Documents',
  archives: 'Archives',
  other: 'Other',
};

export default function StorageScreen() {
  const router = useRouter();
  const { storage } = useDemoData();
  const hasData = storage.totalBytes > 0;
  const used = hasData ? storage.usedBytes / storage.totalBytes : 0;
  const keys = Object.keys(LABELS) as CategoryKey[];

  return (
    <ScreenContainer title="Storage" onBack={() => router.back()}>
      {hasData ? (
        <>
          <Card style={styles.summary}>
            <ProgressRing value={used} />
            <View style={styles.summaryText}>
              <Text variant="label" tone="secondary">
                Used on this phone
              </Text>
              <Text variant="heading">
                {formatBytes(storage.usedBytes)} of {formatBytes(storage.totalBytes)}
              </Text>
            </View>
          </Card>

          <View style={styles.section}>
            <SectionHeader title="By type" />
            <Card style={styles.breakdown}>
              {keys.map((k) => (
                <View key={k} style={styles.line}>
                  <View style={styles.lineHead}>
                    <Text variant="body">{LABELS[k]}</Text>
                    <Text variant="caption" tone="secondary">
                      {formatBytes(storage.byCategory[k])}
                    </Text>
                  </View>
                  <ProgressBar
                    value={storage.byCategory[k] / storage.usedBytes}
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
          description="Storage insights appear once you have saved files."
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  summaryText: { flex: 1, gap: 2 },
  section: { marginTop: spacing.xxl },
  breakdown: { gap: spacing.lg },
  line: { gap: 8 },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between' },
});
