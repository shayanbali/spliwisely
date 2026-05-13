import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

/**
 * iOS 26 "Liquid Glass" design tokens.
 * Base brand accent remains #1aa672; primary UI accent uses the more vibrant
 * iOS system green (#30D158).
 */
export const C = {
  // Brand
  brand: '#1aa672',
  accent: '#30D158',
  accentDark: '#25A64B',
  accentSoft: 'rgba(48,209,88,0.12)',
  accentSoftText: '#30D158',

  // Backgrounds
  bg: '#F2F2F7',              // iOS grouped background
  bgElevated: 'rgba(255,255,255,0.85)',
  bgGlass: 'rgba(255,255,255,0.88)',
  bgOverlay: 'rgba(255,255,255,0.4)',
  glassBorder: 'rgba(255,255,255,0.7)',

  // Text
  text: '#1C1C1E',            // iOS label
  textSecondary: '#6E6E73',   // iOS secondary label
  textTertiary: '#8E8E93',
  textMuted: '#AEAEB2',

  // Status
  positive: '#30D158',
  negative: '#FF3B30',
  warning: '#FF9F0A',

  // Inputs / fills
  inputFill: 'rgba(118,118,128,0.12)',
  inputFillStrong: 'rgba(118,118,128,0.20)',
  placeholder: '#9A9A9F',

  // Lines
  separator: 'rgba(60,60,67,0.1)',
  hairline: 'rgba(60,60,67,0.2)',

  // Shadow / scrim
  shadow: '#000',
  scrim: 'rgba(0,0,0,0.3)',

  // Misc
  white: '#FFFFFF',
  chevron: 'rgba(60,60,67,0.3)',
};

export const TAB_PAD = 110;

const card: ViewStyle = {
  backgroundColor: C.bgElevated,
  borderRadius: 20,
  padding: 16,
};

const shadow: ViewStyle = {
  shadowColor: C.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.07,
  shadowRadius: 18,
  elevation: 4,
};

const shadowSm: ViewStyle = {
  shadowColor: C.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

const sectionTitle: TextStyle = {
  fontSize: 13,
  fontWeight: '600',
  color: C.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8,
  marginLeft: 4,
};

const input: TextStyle = {
  borderWidth: 0,
  backgroundColor: C.inputFill,
  borderRadius: 14,
  padding: 14,
  fontSize: 16,
  color: C.text,
};

const btn: ViewStyle = {
  backgroundColor: C.accent,
  borderRadius: 16,
  paddingVertical: 16,
  paddingHorizontal: 20,
  alignItems: 'center',
  justifyContent: 'center',
};

const screenTitle: TextStyle = {
  fontSize: 34,
  fontWeight: '800',
  letterSpacing: -0.5,
  color: C.text,
};

const separator: ViewStyle = {
  height: StyleSheet.hairlineWidth,
  backgroundColor: C.separator,
};

export const S = {
  card,
  shadow,
  shadowSm,
  sectionTitle,
  input,
  btn,
  screenTitle,
  separator,
};
