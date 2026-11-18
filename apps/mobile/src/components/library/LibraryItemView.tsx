import { Image } from 'expo-image';
import {
  Archive,
  Check,
  File as FileIcon,
  FileText,
  Folder,
  Image as ImageIcon,
  Music,
  Star,
  Video,
  type LucideIcon,
} from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import type { FileCategory, FileRecord } from '@/db/types';
import type { LibraryItem } from '@/features/library/query';
import { categoryColors, radius, spacing, useTheme, withAlpha } from '@/theme';
import { formatBytes, formatDuration, formatShortDate } from '@/utils/format';

export const LIST_ROW_HEIGHT = 64;
export const GRID_CAPTION_HEIGHT = 52;

const CATEGORY_ICON: Record<FileCategory, LucideIcon> = {
  videos: Video,
  audio: Music,
  images: ImageIcon,
  documents: FileText,
  archives: Archive,
  other: FileIcon,
};

export const CATEGORY_LABEL: Record<FileCategory, string> = {
  videos: 'Video',
  audio: 'Audio',
  images: 'Image',
  documents: 'Document',
  archives: 'Archive',
  other: 'File',
};

const FOLDER_TINT = categoryColors.documents;

function fileCaption(f: FileRecord, mode: 'grid' | 'list'): string {
  const size = formatBytes(f.sizeBytes);
  if (mode === 'grid') return f.durationSec ? `${formatDuration(f.durationSec)} · ${size}` : size;
  return [CATEGORY_LABEL[f.category], size, formatShortDate(f.createdAt)].join(' · ');
}

function Thumb({ file, size, rounded }: { file: FileRecord; size: number; rounded: number }) {
  const tint = categoryColors[file.category];
  const Icon = CATEGORY_ICON[file.category];
  if (file.thumbnailPath) {
    return (
      <Image
        source={{ uri: file.thumbnailPath }}
        recyclingKey={file.id}
        contentFit="cover"
        transition={80}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: rounded }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        backgroundColor: withAlpha(tint, 0.16),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon color={tint} size={Math.round(size * 0.42)} strokeWidth={2} />
    </View>
  );
}

function SelectDot({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.dot,
        {
          borderColor: selected ? colors.primary : colors.textSecondary,
          backgroundColor: selected ? colors.primary : 'rgba(0,0,0,0.35)',
        },
      ]}
    >
      {selected ? <Check color={colors.onPrimary} size={13} strokeWidth={3} /> : null}
    </View>
  );
}

export interface LibraryItemViewProps {
  item: LibraryItem;
  mode: 'grid' | 'list';
  /** Tile width in grid mode. */
  tileSize: number;
  selected: boolean;
  selecting: boolean;
  onPress: (item: LibraryItem) => void;
  onLongPress: (item: LibraryItem) => void;
}

/** One file or folder, as a grid tile or a list row. Memoized so scrolling a long list stays cheap. */
export const LibraryItemView = memo(function LibraryItemView({
  item,
  mode,
  tileSize,
  selected,
  selecting,
  onPress,
  onLongPress,
}: LibraryItemViewProps) {
  const { colors } = useTheme();
  const isFile = item.kind === 'file';
  const name = isFile ? item.file.name : item.folder.name;
  const caption = isFile
    ? fileCaption(item.file, mode)
    : `${item.count} ${item.count === 1 ? 'item' : 'items'}`;
  const favorite = isFile && item.file.isFavorite;
  const label = `${name}, ${isFile ? CATEGORY_LABEL[item.file.category] : 'Folder'}, ${caption}${favorite ? ', favorite' : ''}${selected ? ', selected' : ''}`;

  const press = () => onPress(item);
  const longPress = () => onLongPress(item);

  if (mode === 'list') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={press}
        onLongPress={longPress}
        delayLongPress={300}
        style={({ pressed }) => [
          styles.row,
          selected && { backgroundColor: colors.primarySoft },
          pressed && { opacity: 0.8 },
        ]}
      >
        {isFile ? (
          <Thumb file={item.file} size={48} rounded={radius.sm} />
        ) : (
          <View style={[styles.folderBox, { backgroundColor: withAlpha(FOLDER_TINT, 0.18) }]}>
            <Folder color={FOLDER_TINT} size={22} fill={withAlpha(FOLDER_TINT, 0.35)} />
          </View>
        )}
        <View style={styles.rowText}>
          <Text variant="bodyLarge" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {caption}
          </Text>
        </View>
        {favorite && !selecting ? (
          <Star color={colors.primary} fill={colors.primary} size={16} />
        ) : null}
        {selecting ? <SelectDot selected={selected} /> : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={press}
      onLongPress={longPress}
      delayLongPress={300}
      style={({ pressed }) => [{ width: tileSize }, pressed && { opacity: 0.8 }]}
    >
      <View>
        {isFile ? (
          <Thumb file={item.file} size={tileSize} rounded={radius.md} />
        ) : (
          <View
            style={[
              styles.folderTile,
              { width: tileSize, height: tileSize, backgroundColor: withAlpha(FOLDER_TINT, 0.16) },
            ]}
          >
            <Folder
              color={FOLDER_TINT}
              size={Math.round(tileSize * 0.42)}
              fill={withAlpha(FOLDER_TINT, 0.35)}
            />
          </View>
        )}
        {selected ? (
          <View style={[styles.tint, { borderColor: colors.primary, borderRadius: radius.md }]} />
        ) : null}
        {selecting ? (
          <View style={styles.dotCorner}>
            <SelectDot selected={selected} />
          </View>
        ) : null}
        {favorite && !selecting ? (
          <View style={styles.starCorner}>
            <Star color="#FFFFFF" fill="#FFFFFF" size={12} />
          </View>
        ) : null}
      </View>
      <View style={styles.caption}>
        <Text variant="label" numberOfLines={2} style={styles.captionName}>
          {name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: LIST_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, gap: 2 },
  folderBox: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderTile: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tint: { ...StyleSheet.absoluteFill, borderWidth: 2.5 },
  dotCorner: { position: 'absolute', top: 6, left: 6 },
  starCorner: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    padding: 4,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { height: GRID_CAPTION_HEIGHT, paddingTop: 6, gap: 1 },
  captionName: { lineHeight: 16 },
});
