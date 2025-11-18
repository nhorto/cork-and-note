// utils/MapUtils.js
import Supercluster from 'supercluster';

export class ClusterManager {
  constructor() {
    this.supercluster = new Supercluster({
      radius: 40,
      maxZoom: 16,
      minZoom: 0,
      minPoints: 2,
    });
    this.isLoaded = false;
  }

  loadPoints(points) {
    try {
      if (!points || points.length === 0) {
        this.isLoaded = false;
        return;
      }
      
      console.log('🔄 Loading points into supercluster:', points.length);
      this.supercluster.load(points);
      this.isLoaded = true;
      console.log('✅ Points loaded successfully');
    } catch (error) {
      console.error('❌ Error loading points into supercluster:', error);
      this.isLoaded = false;
    }
  }

  getClusters(bounds, zoom) {
    if (!this.isLoaded) {
      console.log('⚠️ Cluster manager not loaded yet');
      return [];
    }
    
    try {
      const validZoom = Math.max(0, Math.min(16, Math.floor(zoom)));
      console.log('🎯 Getting clusters with bounds:', bounds, 'zoom:', validZoom);
      const clusters = this.supercluster.getClusters(bounds, validZoom);
      console.log('📊 Returned clusters:', clusters.length);
      return clusters;
    } catch (error) {
      console.error('❌ Error getting clusters:', error);
      return [];
    }
  }

  getLeaves(clusterId, limit = 100) {
    if (!this.isLoaded) return [];
    
    try {
      return this.supercluster.getLeaves(clusterId, limit);
    } catch (error) {
      console.error('Error getting cluster leaves:', error);
      return [];
    }
  }
}