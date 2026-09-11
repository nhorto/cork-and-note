// Google Maps (Android) needs an explicit style; MapKit uses userInterfaceStyle.
export function darkMapStyle(colors) {
  return [
    { elementType: 'geometry', stylers: [{ color: colors.neutral.surface }] },
    { elementType: 'labels.text.fill', stylers: [{ color: colors.neutral.inkSecondary }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: colors.neutral.bg }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors.neutral.border }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: colors.neutral.bg }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors.neutral.bg }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: colors.primary.surface }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: colors.neutral.divider }] },
  ];
}

// Theme colours are opaque hex; polygon fills need the same hue with an alpha channel.
export const withAlpha = (hex, alpha) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// Wine-region polygon styling (#275). Light mode keeps the brand purple over
// Apple's pale basemap. Dark mode switches to the gold accent: the dark
// primary purple sits at roughly 1.9:1 against MapKit's charcoal basemap and
// a 12% fill of it simply vanished, which is what Nick saw on his phone.
export function regionStyle(colors, mode, { selected = false } = {}) {
  const hue = mode === 'dark' ? colors.accent.base : colors.primary.base;
  return {
    strokeColor: hue,
    strokeWidth: selected ? 3 : 2,
    fillColor: withAlpha(hue, selected ? 0.26 : 0.16),
  };
}
