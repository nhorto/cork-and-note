import React from 'react';
import { View } from 'react-native';

export default function MapScreen() {
  return (
    <View style={{ flex: 1 }}>
      <iframe
        title="Virginia map"
        width="100%"
        height="100%"
        frameBorder="0"
        style={{ border: 0 }}
        src="https://www.google.com/maps/embed/v1/place?key=AIzaSyBRZBCx2C0UobRGBVgls-0UlPX1Az0qOcg&q=Virginia"
        allowFullScreen
      />
    </View>
  );
}