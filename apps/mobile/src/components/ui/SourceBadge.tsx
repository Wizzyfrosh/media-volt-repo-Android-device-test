import { StyleSheet, View } from 'react-native';
import { sourceColors } from '@/theme';
import { Text } from './Text';

export interface SourceBadgeProps {
  source: string;
  size?: number;
}

/** Small round badge with the source's initial and brand color. */
export function SourceBadge({ source, size = 44 }: SourceBadgeProps) {
  const color = sourceColors[source] ?? sourceColors.web ?? '#6C5CE7';
  const initial = (source[0] ?? '?').toUpperCase();
  return (
    <View
      accessibilityElementsHidden
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text variant="label" style={{ color: '#FFFFFF', fontSize: size * 0.4 }}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ badge: { alignItems: 'center', justifyContent: 'center' } });
