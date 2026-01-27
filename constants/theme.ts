// Theme constants - Premium AI design system
// Based on the indigo/purple palette (Claude / Perplexity vibes)

export const lightColors = {
  // Primary - Indigo accent (premium AI feel)
  primary: '#6366F1',
  primaryLight: '#A5B4FC',
  primaryForeground: '#FFFFFF',

  // Background - Cool neutral
  background: '#FAFAFA',
  foreground: '#1F2937',

  // Card - Pure white
  card: '#FFFFFF',
  cardForeground: '#1F2937',

  // Muted colors
  muted: '#F3F4F6',
  mutedForeground: '#6B7280',

  // Secondary
  secondary: '#F9FAFB',
  secondaryForeground: '#374151',

  // Success - Green for completed items
  success: '#10B981',
  successForeground: '#FFFFFF',

  // Destructive - Red for delete/sign out
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',

  // Border
  border: '#E5E7EB',
  input: '#E5E7EB',

  // Ring focus
  ring: '#6366F1',
};

export const darkColors = {
  // Primary - Indigo accent (premium AI feel)
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryForeground: '#FFFFFF',

  // Background - Deep cool grey
  background: '#111827',
  foreground: '#F9FAFB',

  // Card - Slightly lighter than background
  card: '#1F2937',
  cardForeground: '#F9FAFB',

  // Muted colors
  muted: '#374151',
  mutedForeground: '#9CA3AF',

  // Secondary
  secondary: '#374151',
  secondaryForeground: '#F3F4F6',

  // Success - Green for completed items
  success: '#10B981',
  successForeground: '#064E3B',

  // Destructive - Red for delete/sign out
  destructive: '#EF4444',
  destructiveForeground: '#7F1D1D',

  // Border
  border: '#374151',
  input: '#374151',

  // Ring focus
  ring: '#6366F1',
};

// getThemeColors helper
export const getThemeColors = (isDark: boolean) => (isDark ? darkColors : lightColors);

export const shadows = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHover: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  fab: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const typography = {
  // Font family will be set after loading Inter font
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 24,
    '3xl': 30,
  },
};
