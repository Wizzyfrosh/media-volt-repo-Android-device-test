import { useRouter } from 'expo-router';
import { CircleCheck, Download, TriangleAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DownloadRow, type DownloadActions } from '@/components/DownloadRow';
import { Card, EmptyState, ScreenContainer, Segmented, Text } from '@/components/ui';
import { STATUS_GROUP } from '@/features/downloads/state-machine';
import { useDownloads } from '@/hooks/use-downloads';
import { useServices } from '@/services/ServicesProvider';
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
    title: 'Nothing failed',
    description: 'If a download stops, you can retry it from here.',
  },
} as const;

export default function QueueScreen() {
  const router = useRouter();
  const { downloadEngine: engine, files } = useServices();
  const downloads = useDownloads();
  const [tab, setTab] = useState<Tab>('active');

  const counts = useMemo(
    () => ({
      active: downloads.filter((d) => (STATUS_GROUP.active as readonly string[]).includes(d.status))
        .length,
      completed: downloads.filter((d) => d.status === 'completed').length,
      failed: downloads.filter((d) => (STATUS_GROUP.failed as readonly string[]).includes(d.status))
        .length,
    }),
    [downloads],
  );
  const items = downloads.filter((d) =>
    (STATUS_GROUP[tab] as readonly string[]).includes(d.status),
  );
  const empty = EMPTY_COPY[tab];

  const actions: DownloadActions = {
    onPause: (id) => void engine.pause(id),
    onResume: (id) => void engine.resume(id),
    onCancel: (id) => void engine.cancel(id),
    onRetry: (id) => void engine.retry(id),
    onRemove: (id) => void engine.remove(id),
    onOpen: (d) => {
      if (!d.fileId) return;
      void files.getById(d.fileId).then((f) => {
        if (!f) return;
        const audioOrVideo = f.category === 'videos' || f.category === 'audio';
        router.push({
          pathname: audioOrVideo ? '/player/[fileId]' : '/viewer/[fileId]',
          params: { fileId: f.id },
        });
      });
    },
  };

  const options = TABS.map((t) => ({
    ...t,
    label: counts[t.value] > 0 ? `${t.label} (${counts[t.value]})` : t.label,
  }));

  return (
    <ScreenContainer title="Downloads" onBack={() => router.back()}>
      <Segmented options={options} value={tab} onChange={setTab} />
      {tab !== 'active' && items.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void engine.clearFinished(STATUS_GROUP[tab])}
          style={styles.clear}
          hitSlop={8}
        >
          <Text variant="label" tone="accent">
            Clear list
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.list}>
        {items.length > 0 ? (
          items.map((d) => (
            <Card key={d.id}>
              <DownloadRow d={d} actions={actions} />
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
  list: { marginTop: spacing.lg, gap: spacing.md },
  clear: { alignSelf: 'flex-end', marginTop: spacing.md },
});
