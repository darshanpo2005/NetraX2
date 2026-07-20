// NetraX design system — "Dark Security Dashboard"
// Single source of truth for color, type, spacing and radius tokens.
// Import from here rather than hardcoding hex values in screens.

export const COLORS = {
  background: '#080C14',
  surface: '#0F1923',
  surfaceElevated: '#162032',

  primary: '#2563EB',
  primaryGlow: 'rgba(37,99,235,0.15)',
  primaryBorder: 'rgba(37,99,235,0.4)',
  primaryDim: 'rgba(37,99,235,0.08)',

  success: '#10B981',
  successGlow: 'rgba(16,185,129,0.15)',
  successBorder: 'rgba(16,185,129,0.35)',

  error: '#EF4444',
  errorGlow: 'rgba(239,68,68,0.15)',
  errorBorder: 'rgba(239,68,68,0.35)',

  warning: '#F59E0B',
  warningGlow: 'rgba(245,158,11,0.15)',
  warningBorder: 'rgba(245,158,11,0.35)',

  textPrimary: '#F1F5F9',
  textSecondary: '#64748B',
  textTertiary: '#334155',

  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.1)',

  white: '#FFFFFF',
  overlay: 'rgba(4,8,16,0.85)',
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 32,
} as const;

export const FONT_WEIGHT = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const TRACKING = {
  label: 0.5,
  caps: 1.5,
} as const;

export const SPACING = {
  screen: 20,
  section: 24,
  card: 12,
  inner: 20,
} as const;

export const RADIUS = {
  sm: 10,
  buttonSm: 12,
  button: 14,
  card: 16,
  pill: 20,
} as const;
