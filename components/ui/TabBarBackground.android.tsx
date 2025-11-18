import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabBarBackground() {
  const { bottom } = useSafeAreaInsets();
  
  return (
    <View 
      style={[
        StyleSheet.absoluteFill, 
        { 
          backgroundColor: '#fff',
          paddingBottom: bottom // This ensures proper spacing for Android nav bar
        }
      ]} 
    />
  );
}

export function useBottomTabOverflow() {
  const tabHeight = useBottomTabBarHeight();
  const { bottom } = useSafeAreaInsets();
  return tabHeight - bottom;
}