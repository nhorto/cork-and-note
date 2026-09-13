import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

// Android's system photo picker grants access to only the chosen files. Asking
// for broad library access first is unnecessary and can block selection when
// those permissions are intentionally absent from the release manifest.
export function requestPhotoSelectionPermission() {
  if (Platform.OS === 'android') return Promise.resolve({ status: 'granted' });
  return ImagePicker.requestMediaLibraryPermissionsAsync();
}
