import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Button, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

export interface PromptModalProps {
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Throw an Error to show its message under the field and keep the dialog open. */
  onSubmit: (value: string) => Promise<void> | void;
  onClose: () => void;
}

/** A small text-entry dialog that works the same on Android and iOS. Render it only while it is open. */
export function PromptModal({
  title,
  initialValue = '',
  placeholder,
  confirmLabel = 'Save',
  onSubmit,
  onClose,
}: PromptModalProps) {
  const { colors } = useTheme();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Enter a name.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <Pressable
          accessibilityLabel="Close dialog"
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={() => undefined}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text variant="heading">{title}</Text>
            <TextInput
              autoFocus
              selectTextOnFocus
              value={value}
              onChangeText={(t) => {
                setValue(t);
                if (error) setError(null);
              }}
              onSubmitEditing={() => void submit()}
              placeholder={placeholder}
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
              accessibilityLabel="Name"
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.raised,
                  borderColor: error ? colors.danger : colors.border,
                },
              ]}
            />
            {error ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.flex} />
              <Button
                label={confirmLabel}
                onPress={() => void submit()}
                loading={busy}
                style={styles.flex}
              />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.md,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
