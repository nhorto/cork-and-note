// components/ReportAiResponseModal.js — "Report this response" for an AI
// sommelier reply (Google Play AI-generated content policy: users must be
// able to flag a problematic AI response from inside the app).
//
// Reason radio group + optional free text, inserting into
// public.ai_response_reports (append-only, owner-reviewed) via
// lib/aiReports. On success the sheet flips to a brief in-place confirmation
// instead of an Alert, so the user sees the report actually landed.
// Bottom-sheet idiom borrowed from ReportWineryModal.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AI_REPORT_REASONS, aiReportsService } from '../lib/aiReports';
import { createThemedStyles } from '../styles/ThemeProvider';
import Button from './Button';

export default function ReportAiResponseModal({ visible, messageContent, context = null, onClose }) {
  const { colors, styles } = useScreenTheme();

  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!messageContent) return null;

  const reset = () => {
    setReason(null);
    setDetails('');
    setSubmitted(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const res = await aiReportsService.reportResponse({
        messageContent,
        context,
        reason,
        details,
      });
      if (res.success) {
        setSubmitted(true);
      } else {
        Alert.alert('Something went wrong', 'Your report could not be sent. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.container}>
              <View style={styles.handle} />

              {submitted ? (
                <>
                  {/* Confirmation state — the report landed. */}
                  <View style={styles.confirmIcon}>
                    <Ionicons name="checkmark-circle" size={44} color={colors.primary.base} />
                  </View>
                  <Text style={styles.title}>Thank you</Text>
                  <Text style={styles.confirmText}>
                    Your report was sent — we review every one.
                  </Text>
                  <Button title="Done" onPress={handleClose} />
                </>
              ) : (
                <>
                  <Text style={styles.title}>Report this response</Text>
                  <Text style={styles.subtitle}>
                    Tell us what&apos;s wrong with the sommelier&apos;s reply
                  </Text>

                  <View style={styles.options}>
                    {AI_REPORT_REASONS.map((r, i) => {
                      const selected = reason === r.value;
                      return (
                        <TouchableOpacity
                          key={r.value}
                          style={[styles.option, i === AI_REPORT_REASONS.length - 1 && styles.optionLast]}
                          onPress={() => setReason(r.value)}
                          activeOpacity={0.7}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={r.label}
                        >
                          <Ionicons
                            name={selected ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={selected ? colors.primary.base : colors.neutral.placeholder}
                          />
                          <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                            {r.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TextInput
                    style={styles.detailsInput}
                    placeholder="Anything else we should know? (optional)"
                    placeholderTextColor={colors.neutral.placeholder}
                    value={details}
                    onChangeText={setDetails}
                    multiline
                    maxLength={1000}
                  />

                  <Button
                    title="Submit report"
                    onPress={handleSubmit}
                    disabled={!reason}
                    loading={submitting}
                    style={styles.submitButton}
                  />
                  <Button variant="secondary" title="Cancel" onPress={handleClose} />
                </>
              )}
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.neutral.bg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading.h2,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  options: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  optionLast: {
    borderBottomWidth: 0,
  },
  optionText: {
    ...typography.body.regular,
    color: colors.neutral.inkSecondary,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.neutral.ink,
    fontWeight: '600',
  },
  detailsInput: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  submitButton: {
    marginBottom: spacing.sm,
  },
  confirmIcon: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  confirmText: {
    ...typography.body.regular,
    color: colors.neutral.inkSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
return { colors, styles };
});
