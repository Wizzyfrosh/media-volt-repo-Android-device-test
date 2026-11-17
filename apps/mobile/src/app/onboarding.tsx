import { FolderOpen, Link, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type FlatListProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/ui';
import { useAppStore } from '@/stores/app-store';
import { categoryColors, radius, spacing, useTheme, withAlpha } from '@/theme';

interface Slide {
  key: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 'save',
    icon: Link,
    tint: categoryColors.videos,
    title: 'Save from a link',
    body: 'Paste a link or share it to MediaVault from any app. Downloads keep going in the background.',
  },
  {
    key: 'organize',
    icon: FolderOpen,
    tint: categoryColors.documents,
    title: 'Everything in one place',
    body: 'Browse files, read documents and scan pages without switching apps.',
  },
  {
    key: 'private',
    icon: ShieldCheck,
    tint: categoryColors.audio,
    title: 'Private by design',
    body: 'Lock sensitive files in an encrypted vault that stays on your phone.',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const complete = useAppStore((s) => s.completeOnboarding);
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const onViewable = useCallback<NonNullable<FlatListProps<Slide>['onViewableItemsChanged']>>(
    ({ viewableItems }) => {
      const first = viewableItems[0]?.index;
      if (first != null) setIndex(first);
    },
    [],
  );

  const next = () => {
    if (last) complete();
    else listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.skipRow}>
        {!last ? (
          <Pressable accessibilityRole="button" onPress={complete} hitSlop={12}>
            <Text variant="label" tone="secondary">
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.hero, { backgroundColor: withAlpha(item.tint, 0.16) }]}>
              <View style={[styles.heroInner, { backgroundColor: withAlpha(item.tint, 0.22) }]}>
                <item.icon color={item.tint} size={56} strokeWidth={1.8} />
              </View>
            </View>
            <Text variant="display" style={styles.center}>
              {item.title}
            </Text>
            <Text variant="bodyLarge" tone="secondary" style={styles.center}>
              {item.body}
            </Text>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots} accessibilityElementsHidden>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.primary : colors.border,
                  width: i === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
        <Button label={last ? 'Get started' : 'Next'} onPress={next} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skipRow: {
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.lg,
  },
  hero: {
    width: 220,
    height: 220,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  heroInner: {
    width: 140,
    height: 140,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  footer: { paddingHorizontal: spacing.xl, gap: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { height: 8, borderRadius: 4 },
});
