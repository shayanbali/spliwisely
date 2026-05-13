import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { C } from '../theme';

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

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { bottom: insets.bottom + 12 }]}
    >
      <View style={styles.shadowWrap}>
        <View style={styles.tabBar}>
          <BlurView tint="light" intensity={80} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.glassOverlay]} />

          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const icon = TAB_ICONS[route.name] ?? '•';
            const label = TAB_LABELS[route.name] ?? route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={label}
                onPress={onPress}
                activeOpacity={0.7}
                style={styles.tabItem}
              >
                {focused ? (
                  <View style={styles.activeCircle}>
                    <Ionicons name={icon as any} size={18} color="#fff" />
                  </View>
                ) : (
                  <Ionicons name={`${icon}-outline` as any} size={20} color="rgba(60,60,67,0.4)" />
                )}
                <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
} as const;

export default function Navigation() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'default',
          gestureEnabled: true,
        }}
      >
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
            <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={modalScreenOptions} />
            <Stack.Screen name="EditExpense" component={EditExpenseScreen} options={modalScreenOptions} />
            <Stack.Screen name="SettleUp" component={SettleUpScreen} options={modalScreenOptions} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'fade' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  shadowWrap: {
    borderRadius: 32,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  tabBar: {
    height: 76,
    borderRadius: 36,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  glassOverlay: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: '100%',
  },
  activeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(60,60,67,0.4)',
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: C.accent,
  },
});
