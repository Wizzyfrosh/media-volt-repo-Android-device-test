import { useRouter } from 'expo-router';
import { Check, Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Button, ScreenContainer, Text } from '@/components/ui';
import { FEATURES } from '@/config/features';
import { radius, spacing, useTheme } from '@/theme';

const BENEFITS = [
  'Download up to 4K quality',
  'No daily download limit',
  'Five downloads at the same time',
  'Unlimited files in the vault',
  'All document tools, no daily limits',
];

export default function PaywallScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <ScreenContainer title="MediaVault Pro" onBack={() => router.back()}>
      <View style={[styles.hero, { backgroundColor: colors.primarySoft }]}>
        <Sparkles color={colors.primary} size={36} />
      </View>

      <View style={styles.list}>
        {BENEFITS.map((b) => (
          <View key={b} style={styles.item}>
            <View style={[styles.tick, { backgroundColor: colors.successSoft }]}>
              <Check color={colors.success} size={14} strokeWidth={3} />
            </View>
            <Text variant="bodyLarge" style={styles.flex}>
              {b}
            </Text>
          </View>
        ))}
      </View>

      <Text tone="secondary" style={styles.note}>
        {FEATURES.billing === 'iap'
          ? 'Plans and prices will appear here once store billing is connected.'
          : 'Plans, prices and license activation will appear here once payments are connected.'}
      </Text>
      <Button label="Plans coming soon" disabled fullWidth />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  list: { gap: spacing.lg, marginBottom: spacing.xxl },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  note: { marginBottom: spacing.lg },
});
