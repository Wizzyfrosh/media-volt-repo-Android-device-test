import { useLocalSearchParams, useRouter } from 'expo-router';
import { FolderOpen } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { FileBrowser } from '@/components/library/FileBrowser';
import { EmptyState, ScreenContainer } from '@/components/ui';
import type { FolderRecord } from '@/db/types';
import { useServices } from '@/services/ServicesProvider';

export default function FolderScreen() {
  const router = useRouter();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const { folders, fileService } = useServices();
  const version = useSyncExternalStore(fileService.subscribe, fileService.getVersion);
  const [folder, setFolder] = useState<FolderRecord | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void folders.getById(folderId ?? '').then((f) => {
      if (!cancelled) setFolder(f);
    });
    return () => {
      cancelled = true;
    };
  }, [folders, folderId, version]);

  if (folder === null) {
    return (
      <ScreenContainer title="Folder" onBack={() => router.back()}>
        <EmptyState
          icon={FolderOpen}
          title="Folder not found"
          description="It may have been deleted."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </ScreenContainer>
    );
  }
  if (folder === undefined) return null;
  return <FileBrowser folderId={folder.id} title={folder.name} onBack={() => router.back()} />;
}
