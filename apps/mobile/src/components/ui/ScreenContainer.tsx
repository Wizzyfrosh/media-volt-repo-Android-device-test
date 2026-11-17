import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '@/theme';
import { Text } from './Text';

export interface ScreenContainerProps {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  /** Wrap content in a ScrollView. Turn off when the child is a virtualized list. */
  scroll?: boolean;
  /** Leave room for a bottom tab bar. */
  tabScreen?: boolean;
  contentStyle?: ViewStyle;
  children: ReactNode;
}

export function ScreenContainer({
  title,
  subtitle,
  right,
  onBack,
  scroll = true,
  tabScreen = false,
  contentStyle,
  children,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = tabScreen ? spacing.xxl : insets.bottom + spacing.xxl;

  const header =
    title || right || onBack ? (
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={12}
            style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <ArrowLeft color={colors.text} size={20} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          {title ? (
            <Text variant="title" accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text tone="secondary" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;

  const padding: ViewStyle = { paddingHorizontal: spacing.xl, paddingBottom: bottom };

  return (
    <View
      style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, padding, contentStyle]}>
          {header}
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    minHeight: 44,
  },
  titles: { flex: 1, gap: 2 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
