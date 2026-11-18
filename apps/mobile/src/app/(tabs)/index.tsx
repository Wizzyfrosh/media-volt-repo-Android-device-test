import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import {
  Bell,
  ClipboardPaste,
  Download,
  Link,
  Music,
  Video,
  FileText,
  Archive,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  IconTile,
  ScreenContainer,
  SectionHeader,
  SourceBadge,
  Text,
} from '@/components/ui';
import { FEATURES } from '@/config/features';
import { useClipboardLink } from '@/hooks/use-clipboard-link';
import { DownloadRow } from '@/components/DownloadRow';
import { STATUS_GROUP } from '@/features/downloads/state-machine';
import { useDemoData } from '@/hooks/use-demo-data';
import { useDownloads } from '@/hooks/use-downloads';
import { useExtractors } from '@/hooks/use-extractors';
import { useAppStore } from '@/stores/app-store';
import { categoryColors, radius, spacing, useTheme } from '@/theme';
import { extractHttpUrl, parseHttpUrl } from '@/utils/url';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const demo = useDemoData();
  const clipboardDetection = useAppStore((s) => s.clipboardDetection);
  const { link: clipLink, dismiss } = useClipboardLink(clipboardDetection);
  const extractors = useExtractors();
  const showSources = FEATURES.socialExtraction && extractors?.enabled === true;

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const downloads = useDownloads();
  const active = downloads.filter((d) =>
    (STATUS_GROUP.active as readonly string[]).includes(d.status),
  );
  const recent = downloads.filter((d) => d.status === 'completed').slice(0, 5);

  const preview = (raw: string) => {
    const parsed = parseHttpUrl(raw);
    if (!parsed) {
      setError("That doesn't look like a link. Check it and try again.");
      return;
    }
    setError(null);
    setValue('');
    dismiss();
    router.push({
      pathname: '/preview/[id]',
      params: { id: Date.now().toString(36), url: parsed.href },
    });
  };

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    setValue(extractHttpUrl(text) ?? text.trim());
    setError(null);
  };

  return (
    <ScreenContainer
      tabScreen
      title="Download"
      right={
        <IconButton
          icon={Bell}
          label="Open downloads"
          badge={active.length}
          onPress={() => router.push('/queue')}
        />
      }
    >
      <Card style={styles.pasteCard}>
        <View style={styles.pasteRow}>
          <Link color={colors.textSecondary} size={20} />
          <TextInput
            value={value}
            onChangeText={(t) => {
              setValue(t);
              if (error) setError(null);
            }}
            onSubmitEditing={() => preview(value)}
            placeholder="Paste a video or file link"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            accessibilityLabel="Link to download"
            style={[styles.input, { color: colors.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paste from clipboard"
            onPress={pasteFromClipboard}
            hitSlop={8}
            style={[styles.pasteBtn, { backgroundColor: colors.primarySoft }]}
          >
            <ClipboardPaste color={colors.primary} size={20} />
          </Pressable>
        </View>
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          label="Preview link"
          onPress={() => preview(value)}
          disabled={value.trim().length === 0}
          fullWidth
        />
      </Card>

      {clipLink && value.length === 0 ? (
        <Card
          style={[
            styles.clipCard,
            { backgroundColor: colors.primarySoft, borderColor: colors.primary },
          ]}
        >
          <View style={styles.clipText}>
            <Text variant="label">Link on your clipboard</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {parseHttpUrl(clipLink)?.host ?? clipLink}
            </Text>
          </View>
          <Button label="Use link" onPress={() => preview(clipLink)} style={styles.clipBtn} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={dismiss}
            hitSlop={10}
          >
            <X color={colors.textSecondary} size={18} />
          </Pressable>
        </Card>
      ) : null}

      <View style={styles.section}>
        {showSources ? (
          <>
            <SectionHeader title="Save from" />
            {demo.sources.length > 0 ? (
              <View style={styles.sourceGrid}>
                {demo.sources.map((s) => (
                  <Card key={s.id} style={styles.sourceCard}>
                    <SourceBadge source={s.id} />
                    <Text variant="bodyLarge" style={styles.sourceName}>
                      {s.name}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      Supported
                    </Text>
                  </Card>
                ))}
              </View>
            ) : (
              <Text tone="secondary">
                Instagram, TikTok, Facebook, X, YouTube and Snapchat links work here.
              </Text>
            )}
          </>
        ) : (
          <>
            <SectionHeader title="What you can save" />
            <View style={styles.tileRow}>
              <IconTile
                icon={Video}
                label="Video"
                caption="mp4, mkv"
                tint={categoryColors.videos}
              />
              <IconTile icon={Music} label="Audio" caption="mp3, m4a" tint={categoryColors.audio} />
              <IconTile
                icon={FileText}
                label="Documents"
                caption="pdf, docx"
                tint={categoryColors.documents}
              />
              <IconTile
                icon={Archive}
                label="Archives"
                caption="zip, rar"
                tint={categoryColors.archives}
              />
            </View>
          </>
        )}
      </View>

      {active.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="In progress"
            actionLabel="See all"
            onAction={() => router.push('/queue')}
          />
          <Card style={styles.listCard}>
            {active.map((d) => (
              <DownloadRow key={d.id} d={d} compact />
            ))}
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Recent" />
        {recent.length > 0 ? (
          <Card style={styles.listCard}>
            {recent.map((d) => (
              <DownloadRow key={d.id} d={d} compact />
            ))}
          </Card>
        ) : (
          <EmptyState
            icon={Download}
            title="No downloads yet"
            description="Paste a link above and your files will appear here."
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pasteCard: { gap: spacing.md },
  pasteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  input: { flex: 1, fontSize: 16, minHeight: 44 },
  pasteBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipCard: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  clipText: { flex: 1, gap: 2 },
  clipBtn: { minHeight: 40, paddingHorizontal: spacing.lg },
  section: { marginTop: spacing.xxl },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  sourceCard: { width: '47.5%', alignItems: 'flex-start', gap: spacing.xs },
  sourceName: { marginTop: spacing.sm },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap' },
  listCard: { gap: spacing.lg },
});
