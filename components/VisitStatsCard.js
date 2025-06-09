// components/VisitStatsCard.js
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { visitsService } from '../lib/visits';

const VisitStatsCard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWineries: 0,
    totalVisits: 0,
    totalWines: 0,
    recentVisits: [],
    recentWines: []
  });
  const router = useRouter();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      const { success, visits } = await visitsService.getUserVisits();
      
      if (success && visits) {
        // Calculate stats
        const totalVisits = visits.length;
        
        // Count unique wineries
        const uniqueWineries = new Set();
        visits.forEach(visit => {
          uniqueWineries.add(visit.winery_id);
        });
        const totalWineries = uniqueWineries.size;
        
        // Count total wines
        let totalWines = 0;
        visits.forEach(visit => {
          totalWines += visit.wines?.length || 0;
        });
        
        // Get recent visits (last 3)
        const recentVisits = [...visits]
          .sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
          .slice(0, 3);
        
        // Get recent wines (last 3)
        const allWines = [];
        visits.forEach(visit => {
          if (visit.wines && visit.wines.length > 0) {
            visit.wines.forEach(wine => {
              allWines.push({
                ...wine,
                wineryName: visit.wineries?.name,
                visitDate: visit.visit_date
              });
            });
          }
        });
        
        const recentWines = allWines
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 3);
        
        setStats({
          totalWineries,
          totalVisits,
          totalWines,
          recentVisits,
          recentWines
        });
      }
    } catch (error) {
      console.error('Error loading visit stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Navigate to winery
  const goToWinery = (wineryId) => {
    router.push(`/winery/${wineryId}`);
  };

  // Navigate to wine
  const goToWine = (wineId) => {
    router.push(`/wine/${wineId}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading your stats...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Overview */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="business" size={24} color="#8C1C13" />
          <Text style={styles.statValue}>{stats.totalWineries}</Text>
          <Text style={styles.statLabel}>Wineries</Text>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="calendar" size={24} color="#8C1C13" />
          <Text style={styles.statValue}>{stats.totalVisits}</Text>
          <Text style={styles.statLabel}>Visits</Text>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="wine" size={24} color="#8C1C13" />
          <Text style={styles.statValue}>{stats.totalWines}</Text>
          <Text style={styles.statLabel}>Wines</Text>
        </View>
      </View>
      
      {/* Recent Visits */}
      {stats.recentVisits.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Visits</Text>
            <TouchableOpacity onPress={() => router.push('/wines')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {stats.recentVisits.map((visit, index) => (
            <TouchableOpacity
              key={visit.id}
              style={styles.visitItem}
              onPress={() => goToWinery(visit.winery_id)}
            >
              <View style={styles.visitIcon}>
                <Ionicons name="location" size={20} color="#8C1C13" />
              </View>
              <View style={styles.visitInfo}>
                <Text style={styles.visitName}>{visit.wineries?.name}</Text>
                <Text style={styles.visitDate}>{formatDate(visit.visit_date)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8C1C13" />
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {/* Recent Wines */}
      {stats.recentWines.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Wines</Text>
            <TouchableOpacity onPress={() => router.push('/wines')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {stats.recentWines.map((wine, index) => (
            <TouchableOpacity
              key={wine.id}
              style={styles.visitItem}
              onPress={() => goToWine(wine.id)}
            >
              <View style={[
                styles.wineIcon, 
                { backgroundColor: wine.wine_type?.toLowerCase() === 'red' ? '#8C1C13' : 
                                  wine.wine_type?.toLowerCase() === 'white' ? '#f9f9f9' : '#B08442' }
              ]}>
                <Ionicons 
                  name="wine" 
                  size={16} 
                  color={wine.wine_type?.toLowerCase() === 'white' ? '#3E3E3E' : '#fff'} 
                />
              </View>
              <View style={styles.visitInfo}>
                <Text style={styles.visitName}>
                  {wine.wine_name || wine.wine_varietal || wine.wine_type || 'Unnamed Wine'}
                </Text>
                <Text style={styles.visitDate}>
                  {wine.wineryName} • {formatDate(wine.visitDate)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8C1C13" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  loadingState: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginTop: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  seeAllText: {
    fontSize: 14,
    color: '#8C1C13',
  },
  visitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  visitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(140, 28, 19, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  wineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  visitInfo: {
    flex: 1,
  },
  visitName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3E3E3E',
    marginBottom: 2,
  },
  visitDate: {
    fontSize: 13,
    color: '#666',
  },
});

export default VisitStatsCard;