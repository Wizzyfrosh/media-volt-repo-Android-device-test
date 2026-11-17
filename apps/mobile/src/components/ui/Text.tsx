import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { typography, useTheme, type Palette, type TypeVariant } from '@/theme';

export type TextTone =
  'primary' | 'secondary' | 'tertiary' | 'onPrimary' | 'danger' | 'success' | 'accent';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
}

function toneColor(colors: Palette, tone: TextTone): string {
  switch (tone) {
    case 'secondary':
      return colors.textSecondary;
    case 'tertiary':
      return colors.textTertiary;
    case 'onPrimary':
      return colors.onPrimary;
    case 'danger':
      return colors.danger;
    case 'success':
      return colors.success;
    case 'accent':
      return colors.primary;
    default:
      return colors.text;
  }
}

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText {...rest} style={[typography[variant], { color: toneColor(colors, tone) }, style]} />
  );
}
