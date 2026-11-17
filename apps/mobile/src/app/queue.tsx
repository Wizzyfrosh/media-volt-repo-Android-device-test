import { useRouter } from 'expo-router';
import { CircleCheck, Download, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  EmptyState,
  MediaThumb,
  ProgressBar,
  ScreenContainer,
  Segmented,
  Text,
} from '@/components/ui';
import { useDemoData } from '@/hooks/use-demo-data';
import type { DemoDownload } from '@/mocks/demo';
import { spacing } from '@/theme';

type Tab = 'active' | 'completed' | 'failed';

const TABS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
] as const;

const EMPTY_COPY = {
  active: {
    icon: Download,
    title: 'Nothing downloading',
    description: 'Links you add will download in the background.',
  },
  completed: {
    icon: CircleCheck,
    title: 'No finished downloads',
    description: 'Completed downloads are saved to your library.',
  },
  failed: {
    icon: TriangleAlert,
    title: 'No failed downloads',
    description: 'If a download stops, you can retry it from here.',
  },
} as const;

export default function QueueScreen() {
  const router = useRouter();
  const demo = useDemoData();
  const [tab, setTab] = useState<Tab>('active');
  const items = demo.downloads.filter((d: DemoDownload) => d.status === tab);
  const empty = EMPTY_COPY[tab];

  return (
    <ScreenContainer title="Downloads" onBack={() => router.back()}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      <View style={styles.list}>
        {items.length > 0 ? (
          items.map((d) => (
            <Card key={d.id} style={styles.row}>
              <MediaThumb tint={d.tint} duration={d.duration} width={76} height={56} />
              <View style={styles.text}>
                <Text variant="bodyLarge" numberOfLines={1}>
                  {d.title}
                </Text>
                {d.status === 'active' ? <ProgressBar value={d.progress} /> : null}
                <Text variant="caption" tone={d.status === 'failed' ? 'danger' : 'secondary'}>
                  {d.sizeLabel}
                </Text>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: spacing.xl, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 6 },
});
