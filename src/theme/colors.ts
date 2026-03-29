/** Color palette shape (same keys for light and dark) */
export type ColorPalette = {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  primary: string;
  primaryLight: string;
  text1: string;
  text2: string;
  text3: string;
  green: string;
  red: string;
  blue: string;
  purple: string;
  border: string;
  border2: string;
};

/** Dark theme (default) — spec §11.1 */
export const darkColors: ColorPalette = {
  bg: '#0D0F18',
  surface: '#141720',
  surface2: '#1A1E2C',
  surface3: '#202535',
  primary: '#C8A45A',
  primaryLight: '#E6C97E',
  text1: '#EDE8E0',
  text2: '#9A9DB8',
  text3: '#525778',
  green: '#52B788',
  red: '#E05C5C',
  blue: '#5B9FE8',
  purple: '#B07FD4',
  border: 'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.04)',
};

/** Light theme */
export const lightColors: ColorPalette = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surface2: '#EBEBED',
  surface3: '#E0E0E2',
  primary: '#B8860B',
  primaryLight: '#C8A45A',
  text1: '#1D1D1F',
  text2: '#515154',
  text3: '#86868B',
  green: '#2D8A5E',
  red: '#C94141',
  blue: '#3B7BC9',
  purple: '#8B5A9E',
  border: 'rgba(0,0,0,0.08)',
  border2: 'rgba(0,0,0,0.04)',
};

/** @deprecated Use useTheme().colors so light/dark is respected */
export const colors = darkColors;
