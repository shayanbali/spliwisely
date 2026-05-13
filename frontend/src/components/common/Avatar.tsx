import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { SERVER_ORIGIN } from '../../services/api';

interface Props {
  name?: string | null;
  email?: string;
  avatar?: string | null;
  size?: number;
  fontSize?: number;
  style?: ViewStyle;
}

function resolveUri(avatar: string): string {
  if (avatar.startsWith('http')) return avatar;
  return `${SERVER_ORIGIN}${avatar}`;
}

export default function Avatar({ name, email, avatar, size = 40, fontSize, style }: Props) {
  const initial = (name || email || '?')[0].toUpperCase();
  const radius = size / 2;
  const textSize = fontSize ?? Math.round(size * 0.4);
  const uri = avatar ? resolveUri(avatar) : null;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, { width: size, height: size, borderRadius: radius }, style]}
      />
    );
  }

  return (
    <View style={[styles.base, styles.initials, { width: size, height: size, borderRadius: radius }, style]}>
      <Text style={[styles.text, { fontSize: textSize }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  initials: { backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  text: { fontWeight: '700', color: '#1aa672' },
});
