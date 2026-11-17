import { EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { Card, EmptyState, ListRow, ScreenContainer } from '@/components/ui';
import { categoryColors, spacing } from '@/theme';

export default function VaultScreen() {
  return (
    <ScreenContainer tabScreen title="Vault">
      <EmptyState
        icon={Lock}
        title="Your private vault"
        description="Files you add here are encrypted on this phone and hidden from your gallery. Setting up your PIN and fingerprint comes with the vault release."
      />
      <Card style={styles.facts}>
        <ListRow
          icon={ShieldCheck}
          tint={categoryColors.audio}
          title="Encrypted on your phone"
          subtitle="Nothing is uploaded"
        />
        <ListRow
          icon={EyeOff}
          tint={categoryColors.videos}
          title="Hidden from your gallery"
          subtitle="Only visible inside MediaVault"
        />
        <ListRow
          icon={KeyRound}
          tint={categoryColors.documents}
          title="PIN and fingerprint"
          subtitle="You choose how it unlocks"
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ facts: { marginTop: spacing.sm } });
