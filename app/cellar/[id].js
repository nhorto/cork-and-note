// app/cellar/[id].js - Bottle detail / edit / open (Epic #6 / #25 / #26)
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CellarBottleForm from '../../components/CellarBottleForm';
import ConsumptionHistory from '../../components/ConsumptionHistory';
import MaturityTimeline from '../../components/MaturityTimeline';
import BottlePairing from '../../components/BottlePairing';
import { KEEP_BOTTLE_REASON, cellarService, drinkWindowMeta } from '../../lib/cellar';
import theme from '../../styles/theme';

const { colors, typography, spacing, borderRadius, shadows } = theme;

// Draw-down reasons (everything but the keep-the-bottle sample).
const REASONS = [
  { key: 'consumed', label: 'Drank it' },
  { key: 'gifted', label: 'Gifted' },
  { key: 'sold', label: 'Sold' },
  { key: 'spoiled', label: 'Spoiled' },
];

export default function BottleDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [bottle, setBottle] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Open-bottle modal state. `openMode` is 'open' (a draw-down: drank/gifted/…)
  // or 'taste' (Coravin sample: log a tasting, keep the bottle in inventory).
  const [openVisible, setOpenVisible] = useState(false);
  const [openMode, setOpenMode] = useState('open');
  const [openQty, setOpenQty] = useState(1);
  const [openReason, setOpenReason] = useState('consumed');
  const [logTasting, setLogTasting] = useState(true);
  const [openRating, setOpenRating] = useState(0); // 0 = unrated (never forced)
  const [openNote, setOpenNote] = useState('');
  const [opening, setOpening] = useState(false);

  // Quantity-adjust modal state (inventory correction — no reason logged).
  const [adjustVisible, setAdjustVisible] = useState(false);
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjusting, setAdjusting] = useState(false);

  const openOpenSheet = (mode) => {
    setOpenMode(mode);
    setOpenQty(1);
    setOpenReason('consumed');
    // Tasting on by default for a kept sample (its whole point is the note);
    // for a draw-down it follows the previous "drank it → log" behavior.
    setLogTasting(true);
    setOpenRating(0);
    setOpenNote('');
    setOpenVisible(true);
  };

  const load = useCallback(async () => {
    const res = await cellarService.getBottle(id).catch(() => ({ success: false }));
    setBottle(res?.success ? res.bottle : null);
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleUpdate = async (payload) => {
    setSaving(true);
    const res = await cellarService.updateBottle(id, payload);
    setSaving(false);
    if (res.success) {
      setBottle(res.bottle);
      setEditing(false);
    } else {
      Alert.alert('Could not save', res.error || 'Please try again.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Remove bottle', 'Delete this bottle from your cellar? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await cellarService.deleteBottle(id);
          if (res.success) router.back();
          else Alert.alert('Could not delete', res.error || 'Please try again.');
        },
      },
    ]);
  };

  const confirmOpen = async () => {
    const taste = openMode === 'taste';
    // A kept sample always logs a tasting (that's the point). A draw-down logs
    // only when the user drank it and left the toggle on. Rating is optional.
    const shouldLog = taste || (openReason === 'consumed' && logTasting);
    setOpening(true);
    const res = await cellarService.openBottle(id, {
      quantity: taste ? 1 : openQty,
      reason: taste ? KEEP_BOTTLE_REASON : openReason,
      note: openNote,
      rating: shouldLog && openRating > 0 ? openRating : undefined,
      logTasting: shouldLog,
    });
    setOpening(false);
    setOpenVisible(false);
    if (!res.success) {
      Alert.alert('Could not update', res.error || 'Please try again.');
      return;
    }
    await load();
    const loggedNote = res.wineId ? ' A tasting was added to your journal.' : '';
    if (res.keptBottle) {
      Alert.alert('Tasted', `The bottle stays in your cellar.${loggedNote}`);
    } else if (res.bottle.quantity <= 0) {
      Alert.alert('Bottle removed', `That was your last one.${loggedNote}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else if (loggedNote) {
      Alert.alert('Logged', loggedNote.trim());
    }
  };

  const openAdjustSheet = () => {
    setAdjustQty(bottle?.quantity ?? 0);
    setAdjustVisible(true);
  };

  const confirmAdjust = async () => {
    setAdjusting(true);
    const res = await cellarService.adjustQuantity(id, adjustQty);
    setAdjusting(false);
    setAdjustVisible(false);
    if (!res.success) {
      Alert.alert('Could not update', res.error || 'Please try again.');
      return;
    }
    await load();
    if (res.bottle.quantity <= 0) {
      Alert.alert('Lot emptied', 'This lot now shows zero bottles.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  if (!loaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary.burgundy} />
      </View>
    );
  }

  if (!bottle) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.missing}>This bottle could not be found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const producer = bottle.producer || bottle.wineries?.name;
  const badge = bottle.drinkStatus ? drinkWindowMeta(bottle.drinkStatus) : null;
  const removed = bottle.status !== 'in_cellar';
  const consumptions = bottle.cellar_consumptions || [];
  // Whether the open/taste sheet will write a tasting (drives the rating + note
  // fields): always for a kept sample, else only when "drank it" + log toggle on.
  const willLog = openMode === 'taste' || (openReason === 'consumed' && logTasting);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => (editing ? setEditing(false) : router.back())}>
          <Ionicons name="chevron-back" size={24} color={colors.primary.burgundy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {editing ? 'Edit bottle' : 'Bottle'}
        </Text>
        {!editing && !removed ? (
          <TouchableOpacity style={styles.iconBtn} onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={22} color={colors.primary.burgundy} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>
      <View style={styles.headerBorder} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {editing ? (
            <CellarBottleForm
              initialValues={bottle}
              onSubmit={handleUpdate}
              submitLabel="Save changes"
              saving={saving}
            />
          ) : (
            <>
              {/* Title block */}
              <Text style={styles.wineName}>{bottle.wine_name}</Text>
              {producer ? <Text style={styles.producer}>{producer}</Text> : null}
              <View style={styles.badgeRow}>
                {badge && (
                  <View style={[styles.badge, { backgroundColor: badge.color }]}>
                    <Text style={styles.badgeText}>{badge.label}</Text>
                  </View>
                )}
                {removed && (
                  <View style={[styles.badge, { backgroundColor: colors.neutral.pewter }]}>
                    <Text style={styles.badgeText}>{bottle.status}</Text>
                  </View>
                )}
              </View>

              {/* Quantity */}
              <View style={styles.qtyCard}>
                <View style={styles.qtyMain}>
                  <Text style={styles.qtyNum}>{bottle.quantity}</Text>
                  <Text style={styles.qtyLabel}>
                    {bottle.bottle_size} · {bottle.status === 'in_cellar' ? 'in cellar' : bottle.status}
                  </Text>
                </View>
                {!removed && (
                  <TouchableOpacity style={styles.adjustBtn} onPress={openAdjustSheet} hitSlop={8}>
                    <Ionicons name="create-outline" size={15} color={colors.primary.burgundy} />
                    <Text style={styles.adjustBtnText}>Adjust</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Details */}
              <View style={styles.detailCard}>
                <DetailRow label="Vintage" value={bottle.vintage} />
                <DetailRow label="Type" value={bottle.wine_type} />
                <DetailRow label="Varietal" value={bottle.varietal} />
                <DetailRow label="Region" value={bottle.region} />
                <DetailRow label="Location" value={bottle.location} />
                <DetailRow label="Bin" value={bottle.bin} />
                <DetailRow
                  label="Drink window"
                  value={[bottle.drink_from, bottle.drink_by].some(Boolean)
                    ? `${bottle.drink_from || '—'} – ${bottle.drink_by || '—'}`
                    : null}
                />
                <DetailRow label="Purchased" value={bottle.purchase_date} />
                <DetailRow
                  label="Price"
                  value={bottle.purchase_price != null ? `$${Number(bottle.purchase_price).toFixed(2)}` : null}
                />
                <DetailRow label="Store" value={bottle.store} />
                <DetailRow label="Your rating" value={bottle.rating != null ? `${bottle.rating} / 5` : null} last />
              </View>

              {/* Maturity timeline (R4 / #54): open → peak → decline with the
                  bottle's current position, derived from drink_from/drink_by. */}
              <MaturityTimeline
                drinkFrom={bottle.drink_from}
                drinkBy={bottle.drink_by}
                onAddWindow={!removed ? () => setEditing(true) : undefined}
              />

              {bottle.notes ? (
                <View style={styles.notesCard}>
                  <Text style={styles.notesLabel}>NOTES</Text>
                  <Text style={styles.notesText}>{bottle.notes}</Text>
                </View>
              ) : null}

              {/* Consumption history (date · reason · qty · note · tasting link) */}
              <ConsumptionHistory consumptions={consumptions} />

              {/* Food pairing (R10 / #61): "what should I serve with this?" —
                  bottle-aware dish suggestions, where the decision is made. */}
              {!removed && <BottlePairing bottle={bottle} />}

              {/* Actions */}
              {!removed && bottle.quantity > 0 && (
                <>
                  <TouchableOpacity style={styles.openBtn} activeOpacity={0.9} onPress={() => openOpenSheet('open')}>
                    <Ionicons name="wine" size={20} color={colors.neutral.cream} />
                    <Text style={styles.openBtnText}>Open a bottle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tasteBtn} activeOpacity={0.9} onPress={() => openOpenSheet('taste')}>
                    <Ionicons name="wine-outline" size={18} color={colors.primary.burgundy} />
                    <Text style={styles.tasteBtnText}>Tasted, keep the bottle</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                <Text style={styles.deleteText}>Remove from cellar</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Open-bottle / taste sheet */}
      <Modal visible={openVisible} transparent animationType="slide" onRequestClose={() => setOpenVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {openMode === 'taste' ? (
                <>
                  <Text style={styles.sheetTitle}>Tasted, keep the bottle</Text>
                  <Text style={styles.sheetIntro}>
                    Logs a tasting (a Coravin pour, or a sample). The bottle stays in your cellar.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.sheetTitle}>Open a bottle</Text>

                  <Text style={styles.sheetLabel}>How many?</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setOpenQty((q) => Math.max(1, q - 1))}>
                      <Ionicons name="remove" size={20} color={colors.primary.burgundy} />
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{openQty}</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setOpenQty((q) => Math.min(bottle.quantity, q + 1))}>
                      <Ionicons name="add" size={20} color={colors.primary.burgundy} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.sheetLabel}>What happened?</Text>
                  <View style={styles.reasonRow}>
                    {REASONS.map((r) => (
                      <TouchableOpacity
                        key={r.key}
                        style={[styles.reasonChip, openReason === r.key && styles.reasonChipActive]}
                        onPress={() => setOpenReason(r.key)}
                      >
                        <Text style={[styles.reasonText, openReason === r.key && styles.reasonTextActive]}>{r.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {openReason === 'consumed' && (
                    <View style={styles.tastingRow}>
                      <View style={styles.flex}>
                        <Text style={styles.tastingTitle}>Log a tasting</Text>
                        <Text style={styles.tastingSub}>Add it to your journal, prefilled from this bottle.</Text>
                      </View>
                      <Switch
                        value={logTasting}
                        onValueChange={setLogTasting}
                        trackColor={{ true: colors.primary.burgundy, false: colors.neutral.stone }}
                        thumbColor={colors.neutral.cream}
                      />
                    </View>
                  )}
                </>
              )}

              {/* Optional rating + inline note. Shown whenever a tasting will be
                  logged (always for a kept sample; for a draw-down when "drank
                  it" + the log toggle is on). Rating is never required. */}
              {willLog && (
                <>
                  <View style={styles.ratingHeader}>
                    <Text style={styles.sheetLabel}>Rating (optional)</Text>
                    {openRating > 0 && (
                      <TouchableOpacity onPress={() => setOpenRating(0)} hitSlop={8}>
                        <Text style={styles.clearRating}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity key={n} onPress={() => setOpenRating(n)} hitSlop={6} style={styles.starBtn}>
                        <Ionicons
                          name={n <= openRating ? 'star' : 'star-outline'}
                          size={28}
                          color={n <= openRating ? colors.gold.rich : colors.neutral.stone}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.sheetLabel}>Note (optional)</Text>
                  <TextInput
                    style={styles.noteInput}
                    value={openNote}
                    onChangeText={setOpenNote}
                    placeholder="How was it? With whom, where…"
                    placeholderTextColor={colors.neutral.pewter}
                    multiline
                  />
                  <Text style={styles.editHint}>
                    Saved to your journal — open the tasting later to add flavor notes and more.
                  </Text>
                </>
              )}

              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.sheetCancel} onPress={() => setOpenVisible(false)} disabled={opening}>
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sheetConfirm, opening && styles.submitDisabled]} onPress={confirmOpen} disabled={opening}>
                  <Text style={styles.sheetConfirmText}>
                    {opening ? 'Saving…' : openMode === 'taste' ? 'Log tasting' : 'Confirm'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Quantity-adjust sheet — inventory correction, no reason recorded */}
      <Modal visible={adjustVisible} transparent animationType="slide" onRequestClose={() => setAdjustVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Adjust quantity</Text>
            <Text style={styles.sheetIntro}>
              Correct a miscount. This won’t record a consumption or log a tasting.
            </Text>

            <View style={[styles.stepper, styles.adjustStepper]}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setAdjustQty((q) => Math.max(0, q - 1))}>
                <Ionicons name="remove" size={20} color={colors.primary.burgundy} />
              </TouchableOpacity>
              <Text style={styles.stepValue}>{adjustQty}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setAdjustQty((q) => q + 1)}>
                <Ionicons name="add" size={20} color={colors.primary.burgundy} />
              </TouchableOpacity>
            </View>
            {adjustQty <= 0 && (
              <Text style={styles.editHint}>Setting this to 0 removes the lot from your cellar.</Text>
            )}

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setAdjustVisible(false)} disabled={adjusting}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetConfirm, adjusting && styles.submitDisabled]} onPress={confirmAdjust} disabled={adjusting}>
                <Text style={styles.sheetConfirmText}>{adjusting ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, last }) {
  if (!value) return null;
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.cream },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  missing: { ...typography.body.regular, color: colors.neutral.graphite },
  link: { ...typography.body.regular, color: colors.primary.burgundy },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: spacing.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.heading.h2, color: colors.neutral.charcoal, fontFamily: 'Georgia', flex: 1, textAlign: 'center' },
  headerBorder: { height: 1, backgroundColor: colors.gold.muted, marginHorizontal: spacing.lg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  wineName: { ...typography.heading.h1, color: colors.neutral.charcoal, fontFamily: 'Georgia' },
  producer: { ...typography.body.large, color: colors.neutral.graphite, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  badge: { paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm },
  badgeText: { ...typography.body.caption, color: colors.neutral.cream, fontSize: 10 },

  qtyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  qtyMain: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexShrink: 1 },
  qtyNum: { fontFamily: 'Georgia', fontSize: 32, color: colors.primary.burgundy },
  qtyLabel: { ...typography.body.regular, color: colors.neutral.graphite },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    backgroundColor: colors.neutral.cream,
  },
  adjustBtnText: { ...typography.body.small, color: colors.primary.burgundy, fontWeight: '600' },

  detailCard: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.neutral.linen },
  detailLabel: { ...typography.body.small, color: colors.neutral.pewter },
  detailValue: { ...typography.body.regular, color: colors.neutral.charcoal, fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },

  notesCard: {
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  notesLabel: { ...typography.body.caption, color: colors.gold.shimmer, marginBottom: spacing.xs },
  notesText: { ...typography.body.regular, color: colors.neutral.charcoal, lineHeight: 22 },

  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.burgundy,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xl,
  },
  openBtnText: { ...typography.body.large, color: colors.neutral.cream, fontWeight: '600' },
  tasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.primary.burgundy,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  tasteBtnText: { ...typography.body.regular, color: colors.primary.burgundy, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.sm },
  deleteText: { ...typography.body.regular, color: colors.status.error },

  // Modal / sheet
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay.dark, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.neutral.cream,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    ...shadows.strong,
  },
  sheetTitle: { ...typography.heading.h2, color: colors.neutral.charcoal, fontFamily: 'Georgia', marginBottom: spacing.sm },
  sheetIntro: { ...typography.body.small, color: colors.neutral.graphite, marginBottom: spacing.sm, lineHeight: 19 },
  sheetLabel: { ...typography.body.caption, color: colors.neutral.pewter, marginBottom: spacing.sm, marginTop: spacing.md },

  ratingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearRating: { ...typography.body.small, color: colors.primary.burgundy, fontWeight: '600', marginTop: spacing.md },
  starsRow: { flexDirection: 'row', gap: spacing.xs, alignSelf: 'flex-start' },
  starBtn: { padding: 2 },

  noteInput: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  editHint: { ...typography.body.small, color: colors.neutral.pewter, marginTop: spacing.sm, lineHeight: 18 },

  adjustStepper: { marginTop: spacing.sm },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.parchment,
  },
  stepBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepValue: { width: 56, textAlign: 'center', fontSize: 18, fontFamily: 'Georgia', color: colors.neutral.charcoal },

  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reasonChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    backgroundColor: colors.neutral.parchment,
  },
  reasonChipActive: { backgroundColor: colors.primary.burgundy, borderColor: colors.primary.burgundy },
  reasonText: { ...typography.body.small, color: colors.neutral.graphite },
  reasonTextActive: { color: colors.neutral.cream },

  tastingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  tastingTitle: { ...typography.body.regular, color: colors.neutral.charcoal, fontWeight: '600' },
  tastingSub: { ...typography.body.small, color: colors.neutral.pewter, marginTop: 1 },

  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  sheetCancel: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.primary.burgundy, alignItems: 'center' },
  sheetCancelText: { ...typography.body.regular, color: colors.primary.burgundy, fontWeight: '600' },
  sheetConfirm: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm, backgroundColor: colors.primary.burgundy, alignItems: 'center' },
  sheetConfirmText: { ...typography.body.regular, color: colors.neutral.cream, fontWeight: '600' },
  submitDisabled: { opacity: 0.6 },
});
