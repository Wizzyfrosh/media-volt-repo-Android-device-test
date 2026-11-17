import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Clipboard, HardDrive, Info, RefreshCw, Sparkles, Wifi } from 'lucide-react-native';
import { StyleSheet, Switch, View } from 'react-native';
import {
  Button,
  Card,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Segmented,
  Text,
} from '@/components/ui';
import { FEATURES } from '@/config/features';
import { useAppStore } from '@/stores/app-store';
import { categoryColors, radius, spacing, useTheme, type ThemeMode } from '@/theme';

const THEME_OPTIONS: readonly { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    themeMode,
    setThemeMode,
    wifiOnly,
    setWifiOnly,
    clipboardDetection,
    setClipboardDetection,
  } = useAppStore();
  const version = Constants.expoConfig?.version ?? '0.1.0';

  const switchColors = {
    trackColor: { false: colors.border, true: colors.primary },
    thumbColor: '#FFFFFF',
  };

  return (
    <ScreenContainer tabScreen title="Settings">
      <Card
        style={[styles.pro, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
      >
        <View style={styles.proHead}>
          <View style={[styles.proIcon, { backgroundColor: colors.primary }]}>
            <Sparkles color={colors.onPrimary} size={20} />
          </View>
          <View style={styles.proText}>
            <Text variant="heading">MediaVault Pro</Text>
            <Text tone="secondary">
              Higher quality, more downloads at once, and the full vault.
            </Text>
          </View>
        </View>
        <Button label="See what is included" onPress={() => router.push('/paywall')} fullWidth />
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Downloads" />
        <Card>
          <ListRow
            icon={Wifi}
            tint={categoryColors.other}
            title="Wi-Fi only"
            subtitle="Pause downloads on mobile data"
            right={
              <Switch
                value={wifiOnly}
                onValueChange={setWifiOnly}
                {...switchColors}
                accessibilityLabel="Wi-Fi only"
              />
            }
          />
          <ListRow
            icon={Clipboard}
            tint={categoryColors.videos}
            title="Detect copied links"
            subtitle="Offer to download when you copy a link"
            right={
              <Switch
                value={clipboardDetection}
                onValueChange={setClipboardDetection}
                {...switchColors}
                accessibilityLabel="Detect copied links"
              />
            }
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Appearance" />
        <Segmented options={THEME_OPTIONS} value={themeMode} onChange={setThemeMode} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Storage" />
        <Card>
          <ListRow
            icon={HardDrive}
            tint={categoryColors.archives}
            title="Storage dashboard"
            subtitle="See what is using space"
            chevron
            onPress={() => router.push('/storage')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="About" />
        <Card>
          {FEATURES.selfUpdater ? (
            <ListRow
              icon={RefreshCw}
              tint={categoryColors.audio}
              title="Check for updates"
              subtitle="Updates arrive in a later release"
            />
          ) : null}
          <ListRow icon={Info} tint={categoryColors.other} title="Version" subtitle={version} />
        </Card>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pro: { gap: spacing.lg },
  proHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  proIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proText: { flex: 1, gap: 2 },
  section: { marginTop: spacing.xxl },
});
