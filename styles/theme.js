// styles/theme.js
// "Château Label" Design System - Elegant & Refined
// Inspired by fine French wine label typography and aesthetics

export const colors = {
  // Primary - Deep Bordeaux wines
  primary: {
    burgundy: '#722F37',      // Main accent - deeper, more refined than before
    wine: '#8B1A1A',          // Rich wine red for highlights
    merlot: '#5C1A1A',        // Dark variant for depth
    rosé: '#D4A5A5',          // Soft pink for subtle accents
  },

  // Secondary - Estate gold accents
  gold: {
    rich: '#C9A962',          // Primary gold - elegant, not gaudy
    muted: '#D4C4A8',         // Subtle gold for borders
    light: '#E8DCC8',         // Very light gold for backgrounds
    shimmer: '#B8976A',       // Darker gold for contrast
  },

  // Neutrals - Warm paper tones
  neutral: {
    cream: '#FAF8F5',         // Primary background - warm white
    parchment: '#F5F2ED',     // Card backgrounds
    linen: '#EDE8E0',         // Subtle dividers
    stone: '#D8D2C8',         // Borders and muted elements
    charcoal: '#2C2C2C',      // Primary text
    graphite: '#4A4A4A',      // Secondary text
    pewter: '#7A7A7A',        // Tertiary text
    silver: '#A8A8A8',        // Placeholder text
  },

  // Status colors - Refined versions
  status: {
    visited: '#5B7B5B',       // Sage green - visited wineries
    wishlist: '#6B7B8B',      // Slate blue - want to visit
    success: '#5B7B5B',       // Same sage for success states
    error: '#9B3B3B',         // Muted red for errors
  },

  // Overlay
  overlay: {
    light: 'rgba(250, 248, 245, 0.95)',
    dark: 'rgba(44, 44, 44, 0.6)',
  },
};

export const typography = {
  // Font families - We'll use system fonts that approximate the feel
  // In production, consider expo-google-fonts for Playfair Display + Lora
  fonts: {
    serif: 'Georgia',              // Elegant serif for headings
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
};

export const shadows = {
  // Subtle, elegant shadows
  soft: {
    shadowColor: '#2C2C2C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#2C2C2C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  strong: {
    shadowColor: '#2C2C2C',
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
    backgroundColor: colors.gold.muted,
  },
  // Double line divider (classic wine label style)
  doubleLine: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gold.muted,
    height: 5,
    marginVertical: spacing.md,
  },
  // Corner flourish placeholder
  flourishColor: colors.gold.rich,
};

// Common component styles
export const components = {
  // Refined card style
  card: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    padding: spacing.lg,
    ...shadows.soft,
  },

  // Elegant button base
  button: {
    primary: {
      backgroundColor: colors.primary.burgundy,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.sm,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary.burgundy,
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
    backgroundColor: colors.neutral.cream,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.regular.fontSize,
    color: colors.neutral.charcoal,
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
