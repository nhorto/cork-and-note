// components/PastVisitsSection.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { visitsService } from '../lib/visits';
import WineCard from './WineCard';

const PastVisitsSection = ({ wineryId }) => {
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [expandedVisit, setExpandedVisit] = useState(null);
  const router = useRouter();

  // Load visits for this winery
  useEffect(() => {
    const loadVisits = async () => {
      try {
        setLoading(true);
        const { success, visits } = await visitsService.getUserVisits();
        
        if (success && visits) {
          // Filter visits to this winery
          const wineryVisits = visits.filter(visit => 
            visit.winery_id.toString() === wineryId.toString()
          );
          setVisits(wineryVisits);
        }
      } catch (error) {
        console.error('Error loading visits:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVisits();
  }, [wineryId]);

  // Toggle visit expansion
  const toggleVisitExpansion = (visitId) => {
    if (expandedVisit === visitId) {
      setExpandedVisit(null);
    } else {
      setExpandedVisit(visitId);
    }
  };

  // Navigate to wine detail
  const handleWinePress = (wineId) => {
    router.push(`/wine/${wineId}`);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // If loading
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#8C1C13" />
        <Text style={styles.loadingText}>Loading your past visits...</Text>
      </View>
    );
  }

  // If no visits
  if (visits.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          You haven't logged any visits to this winery yet.
        </Text>
        <TouchableOpacity 
          style={styles.addVisitButton}
          onPress={() => Alert.alert('Log Visit', 'Use the "Log Your Visit" button at the top to add a visit.')}
        >
          <Text style={styles.addVisitButtonText}>Log Your First Visit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render the visits
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Your Past Visits</Text>
      
      {visits.map((visit) => (
        <View key={visit.id} style={styles.visitCard}>
          <TouchableOpacity 
            style={styles.visitHeader}
            onPress={() => toggleVisitExpansion(visit.id)}
          >
            <View style={styles.visitInfo}>
              <Text style={styles.visitDate}>
                {formatDate(visit.visit_date)}
              </Text>
              {visit.notes && (
                <Text style={styles.visitNotes} numberOfLines={expandedVisit === visit.id ? undefined : 1}>
                  {visit.notes}
                </Text>
              )}
            </View>
            
            <View style={styles.visitStats}>
              <View style={styles.wineCount}>
                <Ionicons name="wine" size={16} color="#8C1C13" />
                <Text style={styles.wineCountText}>
                  {visit.wines?.length || 0} wines
                </Text>
              </View>
              <Ionicons 
                name={expandedVisit === visit.id ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#8C1C13" 
              />
            </View>
          </TouchableOpacity>
          
          {/* Expanded content */}
          {expandedVisit === visit.id && visit.wines && visit.wines.length > 0 && (
            <View style={styles.winesList}>
              {visit.wines.map((wine) => (
                <WineCard 
                  key={wine.id}
                  wine={wine}
                  onPress={() => handleWinePress(wine.id)}
                />
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 12,
  },
  visitCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  visitInfo: {
    flex: 1,
    marginRight: 12,
  },
  visitDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  visitNotes: {
    fontSize: 14,
    color: '#666',
  },
  visitStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wineCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(140, 28, 19, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  wineCountText: {
    fontSize: 12,
    color: '#8C1C13',
    marginLeft: 4,
  },
  winesList: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f4f1ef',
  },
  addVisitButton: {
    backgroundColor: '#8C1C13',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addVisitButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default PastVisitsSection;