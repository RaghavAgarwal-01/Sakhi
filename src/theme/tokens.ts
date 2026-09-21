/**
 * Design tokens for Sakhi. Import from here rather than hardcoding hex
 * values in screens — keeps the alarm/manual/home severity distinction
 * consistent everywhere it appears.
 */

export const color = {
  ink: '#12181B',
  canvas: '#F7F5F0',
  guardian: '#1E4841', // primary brand — deep teal, reads as vigilant rather than corporate
  guardianDim: '#A9C4BC',
  alarm: '#A61B2B', // scream/codeword severity
  alarmDeep: '#6E1019',
  marigold: '#C97A2B', // manual-trigger severity — deliberately not a shade of alarm red
  mist: '#DCD7CC', // borders, dividers, disabled states
  white: '#FFFFFF',
} as const;

export const type = {
  display: { fontSize: 40, lineHeight: 48, fontWeight: '800' as const },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 4, // default for inputs, small containers
  md: 12, // secondary actions (e.g. manual trigger)
  pill: 999, // reserved for the single most important action on a screen
} as const;
