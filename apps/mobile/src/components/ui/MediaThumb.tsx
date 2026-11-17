import { Play } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { radius, withAlpha } from '@/theme';
import { Text } from './Text';

export interface MediaThumbProps {
  tint: string;
  duration?: string;
  width?: number;
  height?: number;
}

/** Placeholder thumbnail until real frames are generated in the data phase. */
export function MediaThumb({ tint, duration, width = 88, height = 64 }: MediaThumbProps) {
  return (
    <View style={[styles.box, { width, height, backgroundColor: withAlpha(tint, 0.22) }]}>
      <Play color={tint} size={20} fill={tint} />
      {duration ? (
        <View style={styles.pill}>
          <Text variant="caption" style={styles.pillText}>
            {duration}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pillText: { color: '#FFFFFF', fontSize: 10, lineHeight: 14 },
});
