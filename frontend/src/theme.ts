import { ViewStyle } from 'react-native';

export type ThemeKey = 'emerald' | 'ocean' | 'sunset' | 'midnight';

export interface OrbConfig {
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  color: string;
  opacity: number;
}

export type BlurTint = 'light' | 'dark' | 'default';

export interface ThemeColors {
  brand: string; accent: string; accentDark: string; accentSoft: string; accentSoftText: string;
  bg: string; bgElevated: string; bgGlass: string; bgOverlay: string; glassBorder: string;
  text: string; textSecondary: string; textTertiary: string; textMuted: string;
  positive: string; negative: string; warning: string;
  inputFill: string; inputFillStrong: string; placeholder: string;
  separator: string; hairline: string;
  shadow: string; scrim: string; white: string; chevron: string;
  bgGradient: [string, string];
  statusBar: 'light' | 'dark';
}

const lightBase = {
  positive: '#30D158', negative: '#FF3B30', warning: '#FF9F0A',
  shadow: '#000', scrim: 'rgba(0,0,0,0.3)', white: '#FFFFFF',
  bgElevated: 'rgba(255,255,255,0.92)', bgGlass: 'rgba(255,255,255,0.88)',
  bgOverlay: 'rgba(255,255,255,0.4)', glassBorder: 'rgba(255,255,255,0.7)',
  text: '#1C1C1E', textSecondary: '#6E6E73', textTertiary: '#8E8E93', textMuted: '#AEAEB2',
  inputFill: 'rgba(118,118,128,0.12)', inputFillStrong: 'rgba(118,118,128,0.20)', placeholder: '#9A9A9F',
  separator: 'rgba(60,60,67,0.1)', hairline: 'rgba(60,60,67,0.2)', chevron: 'rgba(60,60,67,0.3)',
  statusBar: 'dark' as const,
};

export const THEMES: Record<ThemeKey, ThemeColors> = {
  emerald: {
    ...lightBase,
    brand: '#1aa672', accent: '#30D158', accentDark: '#25A64B',
    accentSoft: 'rgba(48,209,88,0.12)', accentSoftText: '#30D158',
    bg: '#ECF7F2', bgGradient: ['#ECF7F2', '#E8F0FF'],
  },
  ocean: {
    ...lightBase,
    brand: '#0A84FF', accent: '#0A84FF', accentDark: '#0071E3',
    accentSoft: 'rgba(10,132,255,0.12)', accentSoftText: '#0A84FF',
    bg: '#E8F1FF', bgGradient: ['#E8F1FF', '#EBE8FF'],
  },
  sunset: {
    ...lightBase,
    brand: '#FF6B00', accent: '#FF6B00', accentDark: '#E05A00',
    accentSoft: 'rgba(255,107,0,0.12)', accentSoftText: '#FF6B00',
    bg: '#FFF0E8', bgGradient: ['#FFF0E8', '#FFF0FA'],
  },
  midnight: {
    brand: '#BF5AF2', accent: '#BF5AF2', accentDark: '#9B3DD1',
    accentSoft: 'rgba(191,90,242,0.2)', accentSoftText: '#D08BFA',
    bg: '#0F0E17', bgElevated: 'rgba(255,255,255,0.08)', bgGlass: 'rgba(255,255,255,0.06)',
    bgOverlay: 'rgba(255,255,255,0.04)', glassBorder: 'rgba(255,255,255,0.15)',
    text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.6)', textTertiary: 'rgba(255,255,255,0.45)',
    textMuted: 'rgba(255,255,255,0.3)',
    positive: '#30D158', negative: '#FF453A', warning: '#FF9F0A',
    inputFill: 'rgba(255,255,255,0.1)', inputFillStrong: 'rgba(255,255,255,0.15)',
    placeholder: 'rgba(255,255,255,0.3)', separator: 'rgba(255,255,255,0.1)',
    hairline: 'rgba(255,255,255,0.15)', chevron: 'rgba(255,255,255,0.3)',
    shadow: '#000', scrim: 'rgba(0,0,0,0.6)', white: '#FFFFFF',
    bgGradient: ['#0F0E17', '#1C1030'],
    statusBar: 'light',
  },
};

export const THEME_META: Record<ThemeKey, { label: string; emoji: string }> = {
  emerald:  { label: 'Emerald',  emoji: '🌿' },
  ocean:    { label: 'Ocean',    emoji: '🌊' },
  sunset:   { label: 'Sunset',   emoji: '🌅' },
  midnight: { label: 'Midnight', emoji: '🌙' },
};

export const THEME_ORBS: Record<ThemeKey, OrbConfig[]> = {
  emerald: [
    { size: 340, top: -120, right: -80,  color: '#30D158', opacity: 0.45 },
    { size: 380, bottom: 60, left: -100, color: '#0A84FF', opacity: 0.30 },
    { size: 220, top: 260,  right: -50,  color: '#FFD60A', opacity: 0.28 },
    { size: 160, top: 120,  left:  40,   color: '#5AC8FA', opacity: 0.22 },
  ],
  ocean: [
    { size: 360, top: -100, left: -90,   color: '#0A84FF', opacity: 0.45 },
    { size: 340, bottom: 50, right: -80, color: '#5E5CE6', opacity: 0.40 },
    { size: 200, top: 200,  right: 30,   color: '#32ADE6', opacity: 0.30 },
    { size: 160, bottom: 180, left: 60,  color: '#BF5AF2', opacity: 0.25 },
  ],
  sunset: [
    { size: 320, top: -80,  right: -60,  color: '#FF6B00', opacity: 0.45 },
    { size: 360, bottom: 40, left: -80,  color: '#FF375F', opacity: 0.35 },
    { size: 240, top: 160,  left:  30,   color: '#FFD60A', opacity: 0.30 },
    { size: 180, top: 320,  right: 20,   color: '#FF9500', opacity: 0.25 },
  ],
  midnight: [
    { size: 400, top: -100, right: -80,  color: '#BF5AF2', opacity: 0.55 },
    { size: 360, bottom: 40, left: -80,  color: '#0A84FF', opacity: 0.40 },
    { size: 260, top: 300,  right: 10,   color: '#FF375F', opacity: 0.30 },
    { size: 200, top: 140,  left: 20,    color: '#30D158', opacity: 0.20 },
  ],
};

export const THEME_BLUR: Record<ThemeKey, { tint: BlurTint; intensity: number }> = {
  emerald:  { tint: 'light', intensity: 55 },
  ocean:    { tint: 'light', intensity: 55 },
  sunset:   { tint: 'light', intensity: 50 },
  midnight: { tint: 'dark',  intensity: 60 },
};

export const C = THEMES.emerald; // static default, overridden by ThemeContext at runtime
export const TAB_PAD = 124;

export const S = {
  shadowSm: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  } as ViewStyle,
  shadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07, shadowRadius: 18, elevation: 4,
  } as ViewStyle,
};
