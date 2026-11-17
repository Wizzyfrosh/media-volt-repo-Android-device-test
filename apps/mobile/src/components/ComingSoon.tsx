import { Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { EmptyState, ScreenContainer } from '@/components/ui';

/** Placeholder for routes whose feature lands in a later phase. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  const router = useRouter();
  return (
    <ScreenContainer title={title} onBack={() => router.back()}>
      <EmptyState
        icon={Clock}
        title="Coming soon"
        description={description}
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    </ScreenContainer>
  );
}
