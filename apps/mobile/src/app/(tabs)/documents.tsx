import { useRouter } from 'expo-router';
import { Archive, FileText, RefreshCw, ScanLine, Scissors, Merge } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Card,
  EmptyState,
  IconTile,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import { useDemoData } from '@/hooks/use-demo-data';
import { categoryColors, radius, spacing, useTheme } from '@/theme';

export default function DocumentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const demo = useDemoData();

  return (
    <ScreenContainer tabScreen title="Documents">
      <View style={styles.bigRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan to PDF"
          onPress={() => router.push('/scanner')}
          style={({ pressed }) => [
            styles.big,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.88 },
          ]}
        >
          <ScanLine color={colors.onPrimary} size={28} />
          <Text variant="heading" tone="onPrimary" style={styles.bigTitle}>
            Scan to PDF
          </Text>
          <Text variant="caption" tone="onPrimary" style={styles.bigSub}>
            Capture pages with your camera
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Convert files"
          onPress={() => router.push({ pathname: '/tools/[tool]', params: { tool: 'convert' } })}
          style={({ pressed }) => [
            styles.big,
            { backgroundColor: categoryColors.archives },
            pressed && { opacity: 0.88 },
          ]}
        >
          <RefreshCw color="#06231F" size={28} />
          <Text variant="heading" style={[styles.bigTitle, styles.darkText]}>
            Convert
          </Text>
          <Text variant="caption" style={[styles.bigSub, styles.darkText]}>
            Images to PDF and back
          </Text>
        </Pressable>
      </View>

      <View style={styles.tools}>
        <IconTile
          icon={Merge}
          label="Merge"
          tint={categoryColors.videos}
          onPress={() => router.push({ pathname: '/tools/[tool]', params: { tool: 'merge' } })}
        />
        <IconTile
          icon={Scissors}
          label="Split"
          tint={categoryColors.images}
          onPress={() => router.push({ pathname: '/tools/[tool]', params: { tool: 'split' } })}
        />
        <IconTile
          icon={Archive}
          label="Compress"
          tint={categoryColors.documents}
          onPress={() => router.push({ pathname: '/tools/[tool]', params: { tool: 'compress' } })}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent documents" />
        {demo.documents.length > 0 ? (
          <Card>
            {demo.documents.map((d) => (
              <ListRow
                key={d.id}
                icon={FileText}
                tint={categoryColors.documents}
                title={d.name}
                subtitle={d.meta}
                chevron
                onPress={() =>
                  router.push({ pathname: '/viewer/[fileId]', params: { fileId: d.id } })
                }
              />
            ))}
          </Card>
        ) : (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Scan a page or save a PDF and it will be listed here."
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bigRow: { flexDirection: 'row', gap: spacing.md },
  big: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
    minHeight: 132,
    justifyContent: 'flex-end',
  },
  bigTitle: { marginTop: spacing.md },
  bigSub: { opacity: 0.85 },
  darkText: { color: '#06231F' },
  tools: { flexDirection: 'row', marginTop: spacing.lg },
  section: { marginTop: spacing.xl },
});
