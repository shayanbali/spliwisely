import React, { useRef } from 'react';
import { Animated, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  onPress: () => void;
  variant?: 'back' | 'close';
  style?: object;
}

export default function BackButton({ onPress, variant = 'back', style }: Props) {
  const { C, themeKey } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const isDark = themeKey === 'midnight';

  function pressIn() {
    Animated.spring(scale, {
      toValue: 1.18,
      useNativeDriver: true,
      speed: 40,
      bounciness: 2,
    }).start();
  }

  function pressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }

  const bg        = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.07)';
  const border    = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.10)';
  const iconColor = isDark ? 'rgba(255,255,255,0.9)'  : '#1C1C1E';

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      activeOpacity={1}
      hitSlop={10}
      style={[styles.touchable, style]}
    >
      {/* Animated wrapper — only handles scale, no background */}
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* Plain View owns the background so it always renders correctly */}
        <View style={[
          styles.circle,
          { backgroundColor: bg, borderColor: border },
          !isDark && styles.shadowLight,
        ]}>
          <Ionicons
            name={variant === 'close' ? 'close' : 'chevron-back'}
            size={variant === 'close' ? 17 : 20}
            color={iconColor}
            style={variant === 'back' ? { marginLeft: -1 } : undefined}
          />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const SIZE = 40;

const styles = StyleSheet.create({
  touchable: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
});
