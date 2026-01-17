// Theme constants matching the Lovable Demo design system
// Based on the warm coral palette from swift-reminder

export const colors = {
  // Primary - Warm coral accent
  primary: '#E8826A',
  primaryLight: '#F5B8A8',
  primaryForeground: '#FFFFFF',

  // Background - Warm off-white
  background: '#FDFBF9',
  foreground: '#2D2824',

  // Card - Pure white with subtle warmth
  card: '#FFFFFF',
  cardForeground: '#2D2824',

  // Muted colors
  muted: '#EDE9E5',
  mutedForeground: '#8A8178',

  // Secondary
  secondary: '#F0EBE7',
  secondaryForeground: '#3D3830',

  // Success - Green for completed items
  success: '#2EB872',
  successForeground: '#FFFFFF',

  // Destructive - Red for delete/sign out
  destructive: '#E54D4D',
  destructiveForeground: '#FFFFFF',

  // Border
  border: '#E8E3DE',
  input: '#E8E3DE',

  // Ring focus
  ring: '#E8826A',
};

export const shadows = {
  soft: {
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHover: {
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  fab: {
    shadowColor: '#E8826A',
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
