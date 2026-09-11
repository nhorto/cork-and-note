// components/WineRegionSheet.js: what opens when a wine-region polygon is tapped.
//
// Names the selected AVA (selection is never colour-only), shows the facts we
// have for it, and offers two ways onward: plan a day there, or list the
// directory wineries LOCATED inside the boundary. That wording is deliberate.
// A winery sitting inside Monticello is not a claim that its wines are
// Monticello wines; a bottle's origin stays whatever its label says.
//
// The winery list is the map's viewport query (capped at 750) filtered by the
// simplified boundary on device, so the count is a floor and shows "+" when
// the cap was hit. A per-region membership query is future server work.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { establishedYear, formatStates, pointInRegion } from '../lib/avaRegions';
import { wineryDirectoryService } from '../lib/wineryDirectory';
import { createThemedStyles } from '../styles/ThemeProvider';
import Button from './Button';

const DIRECTORY_CAP = 750;

export const REGION_ATTRIBUTION =
  'Boundaries from the UC Davis Library AVA project (CC0), simplified for display. Informational only; TTB’s 27 CFR part 9 governs.';

export default function WineRegionSheet({ visible, region, onClose, onClear, onPlanDay, onOpenWinery }) {
  const { colors, styles } = useScreenTheme();
  // 'idle' | 'loading' | 'ready' | 'error'
  const [wineries, setWineries] = useState({ status: 'idle', list: [], capped: false });

  // A fresh region resets the list; it loads only when asked for.
  useEffect(() => {
    setWineries({ status: 'idle', list: [], capped: false });
  }, [region?.id]);

  const loadWineries = async () => {
    if (!region) return;
    setWineries({ status: 'loading', list: [], capped: false });
    const [west, south, east, north] = region.bbox;
    const res = await wineryDirectoryService.getInBounds({ west, south, east, north });
    if (!res.success) {
      setWineries({ status: 'error', list: [], capped: false });
      return;
    }
    const inside = res.wineries
      .filter((w) => w.latitude != null && pointInRegion(w.latitude, w.longitude, region))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    setWineries({ status: 'ready', list: inside, capped: res.wineries.length >= DIRECTORY_CAP });
  };

  if (!region) return null;

  const states = formatStates(region);
  const year = establishedYear(region);
  const metaLine = [states, year ? `established ${year}` : null].filter(Boolean).join(' · ');
  const countLabel = `${wineries.list.length}${wineries.capped ? '+' : ''}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>WINE REGION · AVA</Text>
              <Text style={styles.name} accessibilityRole="header">{region.name}</Text>
              {region.aka ? <Text style={styles.aka}>Also known as {region.aka}</Text> : null}
              {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={colors.neutral.ink} />
            </TouchableOpacity>
          </View>

          {region.within?.length ? (
            <Text style={styles.relation}>Inside: {region.within.join(', ')}</Text>
          ) : null}
          {region.contains?.length ? (
            <Text style={styles.relation}>Contains: {region.contains.join(', ')}</Text>
          ) : null}

          <Button
            title="Plan a day here"
            icon="calendar-outline"
            onPress={() => onPlanDay?.(region)}
            style={styles.planButton}
            accessibilityLabel={`Plan a day in ${region.name}`}
          />

          {wineries.status === 'idle' ? (
            <TouchableOpacity
              style={styles.link}
              onPress={loadWineries}
              accessibilityRole="button"
              accessibilityLabel={`Show wineries located in ${region.name}`}
            >
              <Ionicons name="wine-outline" size={18} color={colors.primary.ink} />
              <Text style={styles.linkText}>Wineries in this area</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary.ink} />
            </TouchableOpacity>
          ) : (
            <View style={styles.wineries}>
              <Text style={styles.sectionTitle}>
                {wineries.status === 'loading'
                  ? 'Finding wineries…'
                  : wineries.status === 'error'
                    ? 'Couldn’t load wineries.'
                    : `${countLabel} ${wineries.list.length === 1 ? 'winery' : 'wineries'} located in ${region.name}`}
              </Text>
              {wineries.status === 'error' && (
                <TouchableOpacity onPress={loadWineries} accessibilityRole="button">
                  <Text style={styles.linkText}>Tap to retry</Text>
                </TouchableOpacity>
              )}
              {wineries.status === 'ready' && wineries.list.length === 0 && (
                <Text style={styles.emptyText}>No directory wineries inside this boundary yet.</Text>
              )}
              {wineries.status === 'ready' && wineries.list.length > 0 && (
                <FlatList
                  data={wineries.list}
                  keyExtractor={(item) => `dir-${item.id}`}
                  style={styles.list}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.wineryRow}
                      activeOpacity={0.7}
                      onPress={() => onOpenWinery?.(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${item.name}`}
                    >
                      <View style={styles.wineryIcon}>
                        <Ionicons name="wine-outline" size={16} color={colors.accent.strong} />
                      </View>
                      <View style={styles.wineryMeta}>
                        <Text style={styles.wineryName} numberOfLines={1}>{item.name}</Text>
                        {[item.city, item.state].filter(Boolean).length > 0 && (
                          <Text style={styles.wineryPlace} numberOfLines={1}>
                            {[item.city, item.state].filter(Boolean).join(', ')}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.accent.strong} />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          <Text style={styles.attribution}>{REGION_ATTRIBUTION}</Text>

          <TouchableOpacity
            style={styles.clear}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear region selection"
          >
            <Text style={styles.clearText}>Clear selection</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const useScreenTheme = createThemedStyles((theme) => {
  const { colors, typography, spacing, borderRadius } = theme;
  const SERIF = typography.fonts.serif;

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay.scrim, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: {
      backgroundColor: colors.neutral.bg,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      maxHeight: '80%',
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.neutral.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    headerCopy: { flex: 1 },
    eyebrow: { ...typography.body.caption, color: colors.accent.ink, marginBottom: spacing.xs },
    name: { ...typography.heading.h2, color: colors.neutral.ink, fontFamily: SERIF },
    aka: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: 2 },
    meta: { ...typography.body.small, color: colors.neutral.inkSecondary, marginTop: spacing.xs },
    relation: { ...typography.body.small, color: colors.neutral.inkSecondary, marginTop: spacing.xs },
    planButton: { marginTop: spacing.md },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
    },
    linkText: { ...typography.body.regular, color: colors.primary.ink, fontWeight: '600', flex: 1 },
    wineries: { marginTop: spacing.md },
    sectionTitle: { ...typography.body.regular, color: colors.neutral.ink, fontWeight: '600' },
    emptyText: { ...typography.body.small, color: colors.neutral.inkTertiary, marginTop: spacing.xs },
    list: { maxHeight: 240, marginTop: spacing.xs },
    separator: { height: 1, backgroundColor: colors.neutral.divider },
    wineryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    wineryIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.accent.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wineryMeta: { flex: 1 },
    wineryName: { ...typography.body.regular, color: colors.neutral.ink },
    wineryPlace: { ...typography.body.small, color: colors.neutral.inkTertiary },
    attribution: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.neutral.inkTertiary,
      marginTop: spacing.md,
    },
    clear: { alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
    clearText: { ...typography.body.small, color: colors.primary.ink, fontWeight: '600' },
  });
  return { colors, styles };
});
