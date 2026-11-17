import { useLocalSearchParams } from 'expo-router';
import { ComingSoon } from '@/components/ComingSoon';

const TITLES: Record<string, string> = {
  merge: 'Merge PDFs',
  split: 'Split PDF',
  convert: 'Convert files',
  compress: 'Compress',
};

export default function ToolScreen() {
  const { tool } = useLocalSearchParams<{ tool: string }>();
  return (
    <ComingSoon
      title={TITLES[tool ?? ''] ?? 'Document tool'}
      description="This document tool arrives in a later release."
    />
  );
}
