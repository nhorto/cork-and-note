// app/places.js — "Your places": every winery you've logged a visit at, as a
// list (#170 item 3). This is the "where have I been" screen the map can't be:
// sorted by most-recent visit, searchable, one tap to the winery page.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import { wineriesService } from '../lib/wineries';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

function formatVisitDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PlacesScreen() {
  const router = useRouter();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const res = await wineriesService.getVisitedWineries();
        if (active) {
          setPlaces(res.wineries);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const query = search.trim().toLowerCase();
  const filtered = query
    ? places.filter((p) => p.name.toLowerCase().includes(query))
    : places;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Your places" />

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.neutral.pewter} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search your places"
          placeholderTextColor={colors.neutral.silver}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.neutral.silver} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.8}
            onPress={() => router.push(`/winery/${item.id}`)}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="location" size={20} color={colors.primary.burgundy} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowSub}>
                {item.visitCount} visit{item.visitCount === 1 ? '' : 's'} · last{' '}
                {formatVisitDate(item.lastVisit)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gold.shimmer} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons name="map-outline" size={40} color={colors.neutral.silver} />
              <Text style={styles.emptyTitle}>
                {query ? 'No places match your search' : 'No places yet'}
              </Text>
              {!query && (
                <>
                  <Text style={styles.emptyText}>
                    Places appear here once you log a visit at a winery.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => router.push('/(tabs)/log')}
                  >
                    <Text style={styles.emptyButtonText}>Log a visit</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: {
    ...typography.body.regular,
    fontWeight: '600',
    color: colors.neutral.charcoal,
  },
  rowSub: {
    ...typography.body.small,
    color: colors.neutral.pewter,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.heading.h3,
    color: colors.neutral.charcoal,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary.burgundy,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  emptyButtonText: {
    ...typography.body.regular,
    color: colors.neutral.cream,
    fontWeight: '600',
  },
});
