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
  TouchableOpacity,
  View,
} from 'react-native';
import CellarBottleForm from '../../components/CellarBottleForm';
import MaturityTimeline from '../../components/MaturityTimeline';
import { cellarService, drinkWindowMeta } from '../../lib/cellar';
import theme from '../../styles/theme';

const { colors, typography, spacing, borderRadius, shadows } = theme;

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

  // Open-bottle modal state
  const [openVisible, setOpenVisible] = useState(false);
  const [openQty, setOpenQty] = useState(1);
  const [openReason, setOpenReason] = useState('consumed');
  const [logTasting, setLogTasting] = useState(true);
  const [opening, setOpening] = useState(false);

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
    setOpening(true);
    const res = await cellarService.openBottle(id, {
      quantity: openQty,
      reason: openReason,
      logTasting: openReason === 'consumed' && logTasting,
    });
    setOpening(false);
    setOpenVisible(false);
    if (!res.success) {
      Alert.alert('Could not update', res.error || 'Please try again.');
      return;
    }
    await load();
    const loggedNote = res.wineId ? ' A tasting was added to your journal.' : '';
    if (res.bottle.quantity <= 0) {
      Alert.alert('Bottle removed', `That was your last one.${loggedNote}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else if (loggedNote) {
      Alert.alert('Logged', loggedNote.trim());
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
  const consumptions = (bottle.cellar_consumptions || []).length;

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
                <Text style={styles.qtyNum}>{bottle.quantity}</Text>
                <Text style={styles.qtyLabel}>
                  {bottle.bottle_size} · in cellar
                </Text>
              </View>

              {/* Details */}
              <View style={styles.detailCard}>
                <DetailRow label="Vintage" value={bottle.vintage} />
                <DetailRow label="Type" value={bottle.wine_type} />
                <DetailRow label="Varietal" value={bottle.varietal} />
                <DetailRow label="Region" value={bottle.region} />
                <DetailRow label="Location" value={bottle.location} />
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
                <DetailRow label="Your rating" value={bottle.rating != null ? `${bottle.rating} / 5` : null} />
                <DetailRow label="Times opened" value={consumptions > 0 ? String(consumptions) : null} last />
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

              {/* Actions */}
              {!removed && bottle.quantity > 0 && (
                <TouchableOpacity style={styles.openBtn} activeOpacity={0.9} onPress={() => { setOpenQty(1); setOpenReason('consumed'); setLogTasting(true); setOpenVisible(true); }}>
                  <Ionicons name="wine" size={20} color={colors.neutral.cream} />
                  <Text style={styles.openBtnText}>Open a bottle</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                <Text style={styles.deleteText}>Remove from cellar</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Open-bottle sheet */}
      <Modal visible={openVisible} transparent animationType="slide" onRequestClose={() => setOpenVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
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

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setOpenVisible(false)} disabled={opening}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetConfirm, opening && styles.submitDisabled]} onPress={confirmOpen} disabled={opening}>
                <Text style={styles.sheetConfirmText}>{opening ? 'Saving…' : 'Confirm'}</Text>
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
    alignItems: 'baseline',
    gap: spacing.sm,
    backgroundColor: colors.gold.light,
    borderWidth: 1,
    borderColor: colors.gold.muted,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  qtyNum: { fontFamily: 'Georgia', fontSize: 32, color: colors.primary.burgundy },
  qtyLabel: { ...typography.body.regular, color: colors.neutral.graphite },

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
  sheetTitle: { ...typography.heading.h2, color: colors.neutral.charcoal, fontFamily: 'Georgia', marginBottom: spacing.md },
  sheetLabel: { ...typography.body.caption, color: colors.neutral.pewter, marginBottom: spacing.sm, marginTop: spacing.sm },

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
