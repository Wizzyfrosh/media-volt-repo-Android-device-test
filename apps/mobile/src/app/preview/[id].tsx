import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, ErrorState, MediaThumb, Sheet, Skeleton, Text } from '@/components/ui';
import { FEATURES } from '@/config/features';
import { radius, spacing, useTheme } from '@/theme';
import { parseHttpUrl } from '@/utils/url';

type Phase = 'resolving' | 'ready' | 'unavailable';

interface FormatOption {
  id: string;
  label: string;
  detail: string;
  pro?: boolean;
}

// Sample formats shown in development builds until the resolver exists (Phase 2).
const DEMO_FORMATS: FormatOption[] = [
  { id: 'hd', label: 'HD video', detail: '1080p, 9.56 MB' },
  { id: 'sd', label: 'SD video', detail: '480p, 2.2 MB' },
  { id: 'audio', label: 'Audio only', detail: 'm4a, 1.1 MB' },
  { id: '4k', label: '4K video', detail: '2160p, 48 MB', pro: true },
];

export default function PreviewSheet() {
  const router = useRouter();
  const { colors } = useTheme();
  const { url } = useLocalSearchParams<{ id: string; url?: string }>();
  const host = parseHttpUrl(url)?.host ?? 'this link';
  const [phase, setPhase] = useState<Phase>('resolving');
  const [selected, setSelected] = useState('sd');

  useEffect(() => {
    const t = setTimeout(() => setPhase(FEATURES.demoData ? 'ready' : 'unavailable'), 700);
    return () => clearTimeout(t);
  }, []);

  const pick = (o: FormatOption) => {
    if (o.pro) {
      router.push('/paywall');
      return;
    }
    setSelected(o.id);
  };

  return (
    <Sheet>
      {phase === 'resolving' ? (
        <View style={styles.gap}>
          <Text variant="heading" style={styles.center}>
            Checking {host}
          </Text>
          <View style={styles.row}>
            <Skeleton width={88} height={64} borderRadius={radius.md} />
            <View style={styles.flex}>
              <Skeleton height={18} />
              <Skeleton width="60%" height={14} style={styles.mt} />
            </View>
          </View>
          <Skeleton height={52} borderRadius={radius.md} />
          <Skeleton height={52} borderRadius={radius.md} />
        </View>
      ) : null}

      {phase === 'unavailable' ? (
        <ErrorState
          title="Preview is not ready yet"
          message="Link previews arrive in the next update. Your link was not sent anywhere."
          retryLabel="Close"
          onRetry={() => router.back()}
        />
      ) : null}

      {phase === 'ready' ? (
        <>
          <Text variant="heading" style={styles.center}>
            Video found
          </Text>
          <View style={styles.row}>
            <MediaThumb tint="#6C5CE7" duration="1:24" />
            <View style={styles.flex}>
              <Text variant="bodyLarge" numberOfLines={2}>
                Rooftop sunset timelapse
              </Text>
              <Text variant="caption" tone="secondary">
                {host}
              </Text>
            </View>
          </View>

          <View style={styles.options} accessibilityRole="radiogroup">
            {DEMO_FORMATS.map((o) => {
              const on = o.id === selected;
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${o.label}, ${o.detail}${o.pro ? ', Pro' : ''}`}
                  onPress={() => pick(o)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: colors.raised,
                      borderColor: on ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.flex}>
                    <Text variant="bodyLarge">{o.label}</Text>
                    <Text variant="caption" tone="secondary">
                      {o.detail}
                    </Text>
                  </View>
                  {o.pro ? (
                    <Lock color={colors.textSecondary} size={18} />
                  ) : (
                    <View
                      style={[
                        styles.check,
                        {
                          backgroundColor: on ? colors.primary : 'transparent',
                          borderColor: on ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {on ? <Check color={colors.onPrimary} size={14} strokeWidth={3} /> : null}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => router.back()}
              style={styles.flex}
            />
            <Button
              label="Download"
              onPress={() => {
                router.back();
                router.push('/queue');
              }}
              style={styles.flex}
            />
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.lg },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: 'auto' },
});
