import { useLocalSearchParams, useRouter } from 'expo-router';
import { FolderOpen } from 'lucide-react-native';
import { EmptyState, ScreenContainer } from '@/components/ui';
import { useDemoData } from '@/hooks/use-demo-data';

export default function FolderScreen() {
  const router = useRouter();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const demo = useDemoData();
  const name = demo.folders.find((f) => f.id === folderId)?.name ?? 'Folder';

  return (
    <ScreenContainer title={name} onBack={() => router.back()}>
      <EmptyState
        icon={FolderOpen}
        title="This folder is empty"
        description="Move files here from the Library to keep them together."
      />
    </ScreenContainer>
  );
}
