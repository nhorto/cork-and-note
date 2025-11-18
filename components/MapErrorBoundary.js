// components/MapErrorBoundary.js
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error details
    console.error('MapView Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    
    // You can also send this to a crash reporting service
    // crashlytics().recordError(error);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Map Error</Text>
          <Text style={styles.errorMessage}>
            {this.state.error && this.state.error.toString()}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          
          {__DEV__ && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <Text style={styles.debugText}>
                {this.state.errorInfo.componentStack}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#d32f2f',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  retryButton: {
    backgroundColor: '#8C1C13',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
  },
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
    maxHeight: 200,
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default MapErrorBoundary;