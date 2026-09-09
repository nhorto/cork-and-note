// styles/theme.js
// "Château Label" Design System - Elegant & Refined
// Inspired by fine French wine label typography and aesthetics

import { Platform } from 'react-native';

// NOTE: Token *names* below are role-based (base/deep/darkest/soft, accent
// base/border/surface/strong/ink, neutral bg/surface/divider/border/ink/
// inkSecondary/inkTertiary/placeholder) so future re-themes only need new
// VALUES, not a rename. Values below are the "Spritz" palette (direction D —
// sunset coral + apricot on warm ivory, plum ink).
export const colors = {
  // Primary - Spritz coral family
  primary: {
    base: '#E4573D',          // Main accent - sunset coral
    deep: '#B03A24',          // Deeper, pressed coral-red for highlights/active states
    darkest: '#6B2A3A',       // Deepest variant - coral-plum, for depth
    soft: '#F0A99A',          // Soft coral-pink for subtle accents
  },

  // Accent - Spritz apricot accents
  accent: {
    base: '#F4A259',          // Primary apricot - warm, golden-hour
    border: '#F8CBA0',        // Subtle apricot for borders
    surface: '#FDE9D2',       // Very light apricot for backgrounds
    strong: '#C97A3D',        // Darker apricot/amber for contrast
    ink: '#8C5A12',           // Readable amber for ink — AA on ivory (5.56:1)
    // Use base/border/surface/strong for rules, borders, icons, stars only — never as small text.
  },

  // Neutrals - Warm ivory tones
  neutral: {
    bg: '#FFF8F0',             // Primary background - warm ivory
    surface: '#FFF3E6',        // Card backgrounds
    divider: '#F2E2D2',        // Subtle dividers
    border: '#DCC0AC',         // Borders and muted elements
    ink: '#3D2B3D',            // Primary text - plum ink
    inkSecondary: '#5A4550',   // Secondary text - plum-tinted gray
    inkTertiary: '#7A5A4E',    // Tertiary text — AA on ivory (5.86:1)
    placeholder: '#B09A8C',    // Placeholder text (decorative / non-essential only)
  },

  // Status colors - kept distinguishable from the new coral primary
  status: {
    visited: '#557753',       // Warmed sage green - visited wineries
    wishlist: '#6B7B8B',      // Slate blue - want to visit (unchanged, already reads distinct)
    success: '#557753',       // Same warmed sage for success states
    error: '#C1293E',         // Shifted cooler/crimson so it doesn't collide with primary coral
  },

  // Overlay
  overlay: {
    light: 'rgba(255, 248, 240, 0.95)',
    // Behind a sheet or dialog. A warm, light wash — it separates the sheet from
    // the screen without turning the whole app grey, which is what the old 60%
    // neutral scrim did. Raise the alpha if a sheet ever needs more separation.
    scrim: 'rgba(61, 43, 61, 0.25)',
    // ON TOP of a photo: the contrast plate behind white icons and counters
    // (thumbnail badges, the "3 of 7" pill in the photo viewer). Stays heavy on
    // purpose — this one is about legibility, not depth. Not a sheet backdrop.
    dark: 'rgba(61, 43, 61, 0.6)',
  },
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

export const shadows = {
  // Subtle, elegant shadows
  soft: {
    shadowColor: colors.neutral.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.neutral.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  strong: {
    shadowColor: colors.neutral.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

// Decorative elements
export const decorative = {
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
export const components = {
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

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  decorative,
  components,
};
