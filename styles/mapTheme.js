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
