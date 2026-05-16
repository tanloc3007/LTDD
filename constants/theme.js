// Mau sac va thiet ke chung toan app
const baseLightColors = {
  secondary: '#FF6B35',
  bg: '#F5F6FA',
  white: '#FFFFFF',
  dark: '#1A1A2E',
  gray: '#8892A4',
  lightGray: '#B0BAC9',
  border: '#E8EDF5',
  success: '#2DCE89',
  danger: '#F5365C',
  warning: '#FFC107',
  income: '#2DCE89',
  expense: '#F5365C',
};

const baseDarkColors = {
  secondary: '#FF6B35',
  bg: '#121212',
  white: '#1E1E1E',
  dark: '#FFFFFF',
  gray: '#A0AABF',
  lightGray: '#555F72',
  border: '#2C2C2C',
  success: '#2DCE89',
  danger: '#F5365C',
  warning: '#FFC107',
  income: '#2DCE89',
  expense: '#F5365C',
};

export const accentThemes = {
  pink: {
    key: 'pink',
    label: 'Hồng',
    light: { primary: '#E91E8C', primaryDark: '#C2166F', primaryLight: '#FF4FB8' },
    dark: { primary: '#FF4FB8', primaryDark: '#E91E8C', primaryLight: '#C2166F' },
  },
  blue: {
    key: 'blue',
    label: 'Xanh dương',
    light: { primary: '#2563EB', primaryDark: '#1D4ED8', primaryLight: '#60A5FA' },
    dark: { primary: '#60A5FA', primaryDark: '#2563EB', primaryLight: '#1D4ED8' },
  },
  emerald: {
    key: 'emerald',
    label: 'Xanh lá',
    light: { primary: '#10B981', primaryDark: '#059669', primaryLight: '#6EE7B7' },
    dark: { primary: '#34D399', primaryDark: '#10B981', primaryLight: '#047857' },
  },
  orange: {
    key: 'orange',
    label: 'Cam',
    light: { primary: '#F97316', primaryDark: '#EA580C', primaryLight: '#FDBA74' },
    dark: { primary: '#FB923C', primaryDark: '#F97316', primaryLight: '#C2410C' },
  },
  purple: {
    key: 'purple',
    label: 'Tím',
    light: { primary: '#7C3AED', primaryDark: '#6D28D9', primaryLight: '#A78BFA' },
    dark: { primary: '#A78BFA', primaryDark: '#7C3AED', primaryLight: '#5B21B6' },
  },
  teal: {
    key: 'teal',
    label: 'Xanh ngọc',
    light: { primary: '#0F766E', primaryDark: '#115E59', primaryLight: '#5EEAD4' },
    dark: { primary: '#2DD4BF', primaryDark: '#14B8A6', primaryLight: '#0F766E' },
  },
  red: {
    key: 'red',
    label: 'Đỏ',
    light: { primary: '#DC2626', primaryDark: '#B91C1C', primaryLight: '#FCA5A5' },
    dark: { primary: '#F87171', primaryDark: '#DC2626', primaryLight: '#B91C1C' },
  },
};

export const accentOptions = Object.values(accentThemes).map(({ key, label, light, dark }) => ({
  key,
  label,
  preview: light.primary,
  light,
  dark,
}));

export const buildThemeColors = (theme = 'light', accent = 'pink') => {
  const baseColors = theme === 'dark' ? baseDarkColors : baseLightColors;
  const accentTheme = accentThemes[accent] || accentThemes.pink;
  const accentColors = theme === 'dark' ? accentTheme.dark : accentTheme.light;

  return {
    ...baseColors,
    ...accentColors,
  };
};

export const lightColors = buildThemeColors('light', 'pink');
export const darkColors = buildThemeColors('dark', 'pink');

export const COLORS = lightColors; // Fallback for files not yet refactored

export const FONTS = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
};

export const SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  h1: 28,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#E91E8C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
};
