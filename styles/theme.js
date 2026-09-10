// Royal Velvet (light) and Purple After Dark (dark).
// Fill colors and readable ink colors are distinct roles: deep purple remains
// the brand fill in dark mode while lavender keeps links and icons legible.
import { Platform } from 'react-native';

const lightColors = {
  primary: { base: '#54258A', deep: '#421B70', darkest: '#32165E', soft: '#C9AEDF', ink: '#54258A', surface: '#EEE6F7' },
  accent: { base: '#D6B45D', border: '#E8D9B4', surface: '#F7F0DF', strong: '#96752B', ink: '#806124' },
  neutral: { bg: '#FAF8F4', surface: '#FFFFFF', divider: '#EEE6F7', border: '#D9D1E0', ink: '#2E2438', inkSecondary: '#5E506A', inkTertiary: '#746779', placeholder: '#746779' },
  status: { visited: '#55745E', wishlist: '#596F8B', success: '#55745E', error: '#AD354F', drinkSoon: '#806124', unknown: '#746779' },
  onPrimary: '#FFFFFF', onAccent: '#2E2438', onStatus: '#FFFFFF', onPhoto: '#FFFFFF', shadow: '#21152E',
  journey: { bg: '#54258A', ink: '#FFFFFF', secondary: '#E6D7F4', accent: '#D6B45D', border: '#78509D' },
  overlay: { light: 'rgba(250,248,244,0.95)', scrim: 'rgba(46,36,56,0.25)', dark: 'rgba(25,19,33,0.65)', photo: 'rgba(0,0,0,0.95)', onImage: 'rgba(255,255,255,0.2)' },
};
const darkColors = {
  primary: { base: '#64399B', deep: '#542B86', darkest: '#32165E', soft: '#BDA0DA', ink: '#C9A7F1', surface: '#362643' },
  accent: { base: '#E0BE6C', border: '#655233', surface: '#362D24', strong: '#D4B060', ink: '#E0BE6C' },
  neutral: { bg: '#191321', surface: '#261D31', divider: '#362643', border: '#51405F', ink: '#F5EEF9', inkSecondary: '#D5C8E0', inkTertiary: '#B9A9C8', placeholder: '#B9A9C8' },
  status: { visited: '#90B49A', wishlist: '#A8B8D4', success: '#90B49A', error: '#F090A5', drinkSoon: '#E0BE6C', unknown: '#B9A9C8' },
  onPrimary: '#FFFFFF', onAccent: '#2E2438', onStatus: '#191321', onPhoto: '#FFFFFF', shadow: '#000000',
  journey: { bg: '#64399B', ink: '#FFFFFF', secondary: '#EBDEF7', accent: '#E0BE6C', border: '#9874BE' },
  overlay: { light: 'rgba(25,19,33,0.95)', scrim: 'rgba(9,5,15,0.65)', dark: 'rgba(9,5,15,0.72)', photo: 'rgba(0,0,0,0.95)', onImage: 'rgba(255,255,255,0.2)' },
};

export const typography = {
  // Font families - We'll use system fonts that approximate the feel
  // In production, consider expo-google-fonts for Playfair Display + Lora
  fonts: {
    // Georgia is iOS-only; Android falls back to its generic 'serif' (Noto Serif).
    // Always read this token instead of hardcoding 'Georgia' so Android stays serif.
    serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    sansSerif: 'System',           // Clean system font for body
  },

  // Heading styles
  heading: {
    hero: {
      fontSize: 32,
      fontWeight: '300',           // Light weight for elegance
      letterSpacing: 1.5,
      lineHeight: 40,
    },
    h1: {
      fontSize: 26,
      fontWeight: '400',
      letterSpacing: 0.5,
      lineHeight: 34,
    },
    h2: {
      fontSize: 20,
      fontWeight: '500',
      letterSpacing: 0.3,
      lineHeight: 28,
    },
    h3: {
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: 0.2,
      lineHeight: 24,
    },
  },

  // Body styles
  body: {
    large: {
      fontSize: 17,
      fontWeight: '400',
      lineHeight: 26,
    },
    regular: {
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 22,
    },
    small: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
    },
    caption: {
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      lineHeight: 14,
    },
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
  full: 999, // alias — several components reference borderRadius.full
};

function createTheme(colors, mode) {
const shadows = {
  // Subtle, elegant shadows
  soft: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  strong: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

// Decorative elements
const decorative = {
  // Thin gold rule/divider
  goldRule: {
    height: 1,
    backgroundColor: colors.accent.border,
  },
  // Double line divider (classic wine label style)
  doubleLine: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.accent.border,
    height: 5,
    marginVertical: spacing.md,
  },
  // Corner flourish placeholder
  flourishColor: colors.accent.base,
};

// Common component styles
const components = {
  // Refined card style
  card: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: spacing.lg,
    ...shadows.soft,
  },

  // Elegant button base
  button: {
    primary: {
      backgroundColor: colors.primary.base,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.sm,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary.base,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.sm,
    },
    ghost: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
  },

  // Input field style
  input: {
    backgroundColor: colors.neutral.bg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.regular.fontSize,
    color: colors.neutral.ink,
  },

  // Badge styles
  badge: {
    visited: {
      backgroundColor: colors.status.visited,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.sm,
    },
    wishlist: {
      backgroundColor: colors.status.wishlist,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.sm,
    },
  },
};

return { colors, typography, spacing, borderRadius, shadows, decorative, components, mode, isDark: mode === 'dark' };
}

export const lightTheme = createTheme(lightColors, 'light');
export const darkTheme = createTheme(darkColors, 'dark');
export const themes = { light: lightTheme, dark: darkTheme };
// Static exports support non-rendering consumers and token validation only.
// Screens subscribe through styles/ThemeProvider instead.
export const { colors, shadows, decorative, components } = lightTheme;
export default lightTheme;
