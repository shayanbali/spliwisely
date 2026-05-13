import React, { useMemo, useRef, useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors, TAB_PAD, THEME_ORBS, THEME_BLUR } from '../theme';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import GroupsScreen from '../screens/groups/GroupsScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import FriendsScreen from '../screens/friends/FriendsScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddExpenseScreen from '../screens/expenses/AddExpenseScreen';
import EditExpenseScreen from '../screens/expenses/EditExpenseScreen';
import SettleUpScreen from '../screens/expenses/SettleUpScreen';
import ReceiptScanScreen from '../screens/expenses/ReceiptScanScreen';
import PotPayOutScreen from '../screens/groups/PotPayOutScreen';
import CreditsScreen from '../screens/CreditsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Dashboard: 'scale',
  Groups: 'people',
  Activity: 'time',
  Friends: 'person-add',
  Profile: 'person-circle',
};

const TAB_LABELS: Record<string, string> = {
  Dashboard: 'Balance',
  Groups: 'Groups',
  Activity: 'Activity',
  Friends: 'Friends',
  Profile: 'Profile',
};

function AppBackground() {
  const { C, themeKey } = useTheme();
  const orbs = THEME_ORBS[themeKey];
  const blur = THEME_BLUR[themeKey];
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <LinearGradient
        colors={C.bgGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      {orbs.map((orb, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: orb.size,
            height: orb.size,
            borderRadius: orb.size / 2,
            backgroundColor: orb.color,
            opacity: orb.opacity,
            top: orb.top,
            bottom: orb.bottom,
            left: orb.left,
            right: orb.right,
          }}
        />
      ))}
      <BlurView
        intensity={blur.intensity}
        tint={blur.tint}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function TabItem({ route, index, state, navigation, C, inactiveClr }: {
  route: any; index: number; state: any; navigation: any;
  C: ThemeColors; inactiveClr: string;
}) {
  const focused = state.index === index;
  const iconScale = useRef(new Animated.Value(1)).current;
  const prevFocused = useRef(focused);

  useEffect(() => {
    if (focused && !prevFocused.current) {
      Animated.sequence([
        Animated.spring(iconScale, { toValue: 1.28, useNativeDriver: true, speed: 80, bounciness: 3 }),
        Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
      ]).start();
    }
    prevFocused.current = focused;
  }, [focused]);

  const icon = TAB_ICONS[route.name] ?? '•';
  const label = TAB_LABELS[route.name] ?? route.name;
  const iconColor = focused ? C.accent : inactiveClr;

  const onPress = () => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.8}
      style={staticStyles.tabItem}
    >
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        <Ionicons name={(focused ? icon : `${icon}-outline`) as any} size={20} color={iconColor} />
      </Animated.View>
      <Text style={[staticStyles.tabLabel, { color: iconColor }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { C, themeKey } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = themeKey === 'midnight';

  const pillBg      = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.07)';
  const inactiveClr = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(60,60,67,0.45)';

  const [barWidth, setBarWidth] = useState(0);
  const pillX = useRef(new Animated.Value(-999)).current;
  const tabCount = state.routes.length;

  // padding inside tab bar: paddingHorizontal=4, paddingVertical=4
  const slotWidth = barWidth > 0 ? (barWidth - 8) / tabCount : 0;
  const pillWidth = slotWidth > 4 ? slotWidth - 4 : 0;

  useEffect(() => {
    if (barWidth === 0) return;
    const targetX = 4 + state.index * slotWidth + 2;
    Animated.spring(pillX, {
      toValue: targetX,
      useNativeDriver: false,
      speed: 30,
      bounciness: 10,
    }).start();
  }, [state.index, barWidth]);

  return (
    <View
      pointerEvents="box-none"
      style={[staticStyles.outer, { bottom: insets.bottom + 4 }]}
    >
      <View style={[staticStyles.shadowWrap, isDark && { shadowOpacity: 0.5, shadowRadius: 32 }]}>
        <View
          style={[staticStyles.tabBar, { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.85)' }]}
          onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
        >
          <BlurView tint={isDark ? 'dark' : 'light'} intensity={isDark ? 90 : 80} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(18,12,32,0.65)' : 'rgba(255,255,255,0.42)' }]} />

          {/* Sliding pill — renders behind the tab items */}
          {pillWidth > 0 && (
            <Animated.View
              style={[
                staticStyles.slidingPill,
                { backgroundColor: pillBg, left: pillX, width: pillWidth },
              ]}
            />
          )}

          {state.routes.map((route: any, index: number) => (
            <TabItem
              key={route.key}
              route={route}
              index={index}
              state={state}
              navigation={navigation}
              C={C}
              inactiveClr={inactiveClr}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const modalScreenOptions = {
  animation: 'slide_from_bottom',
  gestureEnabled: true,
  contentStyle: { backgroundColor: 'transparent' },
} as const;

export default function Navigation() {
  const { user, isLoading } = useAuth();
  const { C } = useTheme();

  const navTheme = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: 'transparent',
      card: 'transparent',
    },
  }), []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={C.statusBar === 'dark' ? 'dark' : 'light'} />
      <AppBackground />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'default',
            gestureEnabled: true,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          {user ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen
                name="GroupDetail"
                component={GroupDetailScreen}
                options={{ animation: 'slide_from_right', animationDuration: 320 }}
              />
              <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={modalScreenOptions} />
              <Stack.Screen name="EditExpense" component={EditExpenseScreen} options={modalScreenOptions} />
              <Stack.Screen name="SettleUp" component={SettleUpScreen} options={modalScreenOptions} />
              <Stack.Screen name="ReceiptScan" component={ReceiptScanScreen} options={modalScreenOptions} />
              <Stack.Screen name="PotPayOut" component={PotPayOutScreen} options={modalScreenOptions} />
              <Stack.Screen name="Credits" component={CreditsScreen} options={{ animation: 'slide_from_right', animationDuration: 320 }} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
              <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const staticStyles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  shadowWrap: {
    borderRadius: 34,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 12,
  },
  tabBar: {
    height: 68,
    borderRadius: 34,       // exactly height/2 → perfect outer capsule
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',  // let tabItems stretch to full height so pill can fill it
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 1,
  },
  slidingPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 999,
    zIndex: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
