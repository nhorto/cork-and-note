// components/ChatInput.js
// Text input + camera/photo button + send button, keyboard-aware
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import theme from '../styles/theme';

const { colors, typography, spacing, borderRadius } = theme;

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && photos.length === 0) return;

    onSend(trimmed, photos);
    setText('');
    setPhotos([]);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library permission is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose a source',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickPhoto },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const hasContent = text.trim().length > 0 || photos.length > 0;

  return (
    <View style={styles.container}>
      {/* Photo preview strip */}
      {photos.length > 0 && (
        <ScrollView horizontal style={styles.photoStrip} showsHorizontalScrollIndicator={false}>
          {photos.map((uri, idx) => (
            <View key={idx} style={styles.photoPreview}>
              <Image source={{ uri }} style={styles.photoImage} />
              <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(idx)}>
                <Ionicons name="close-circle" size={18} color={colors.status.error} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.photoButton}
          onPress={showPhotoOptions}
          disabled={disabled}
        >
          <Ionicons
            name="camera"
            size={22}
            color={disabled ? colors.neutral.silver : colors.primary.burgundy}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ask the sommelier..."
          placeholderTextColor={colors.neutral.silver}
          multiline
          maxLength={2000}
          editable={!disabled}
        />

        <TouchableOpacity
          style={[styles.sendButton, hasContent && !disabled && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!hasContent || disabled}
        >
          <Ionicons
            name="send"
            size={18}
            color={hasContent && !disabled ? colors.neutral.cream : colors.neutral.silver}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.stone,
    backgroundColor: colors.neutral.cream,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
  },
  photoStrip: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: 70,
  },
  photoPreview: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  photoImage: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.neutral.cream,
    borderRadius: 9,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  photoButton: {
    padding: spacing.sm,
    marginBottom: 2,
  },
  input: {
    flex: 1,
    backgroundColor: colors.neutral.parchment,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral.stone,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: colors.primary.burgundy,
  },
});
