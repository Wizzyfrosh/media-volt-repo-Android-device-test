import { useRouter } from 'expo-router';
import { Globe } from 'lucide-react-native';
import { ComingSoon } from '@/components/ComingSoon';
import { EmptyState, ScreenContainer } from '@/components/ui';
import { FEATURES } from '@/config/features';

export default function BrowserScreen() {
  const router = useRouter();
  if (!FEATURES.inAppBrowserDetection) {
    return (
      <ScreenContainer title="Browser" onBack={() => router.back()}>
        <EmptyState
          icon={Globe}
          title="Not available in this version"
          description="Paste a link on the Home tab to save a file."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </ScreenContainer>
    );
  }
  return (
    <ComingSoon
      title="Browser"
      description="Browse a site and save the video you find. Arrives in a later release."
    />
  );
}
