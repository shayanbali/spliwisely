import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/common/Avatar';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import { getBalances } from '../services/expenses';
import { fmt } from '../utils/currency';
import { S, TAB_PAD, ThemeColors } from '../theme';

const ICON_SIZE = 80;

function SettledUpIcon({ C, trigger }: { C: ThemeColors; trigger: number }) {
  const entrance  = useRef(new Animated.Value(0)).current;
  const breathe   = useRef(new Animated.Value(1)).current;
  const r1Scale   = useRef(new Animated.Value(1)).current;
  const r1Opacity = useRef(new Animated.Value(0)).current;
  const r2Scale   = useRef(new Animated.Value(1)).current;
  const r2Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // reset
    entrance.setValue(0);
    r1Scale.setValue(1); r1Opacity.setValue(0);
    r2Scale.setValue(1); r2Opacity.setValue(0);
    breathe.setValue(1);

    // spring entrance
    Animated.spring(entrance, {
      toValue: 1, useNativeDriver: true, speed: 10, bounciness: 18,
    }).start();

    // ripple factory
    const ripple = (sc: Animated.Value, op: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(sc, { toValue: 2.6, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.sequence([
            Animated.timing(op, { toValue: 0.28, duration: 150, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0, duration: 1650, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(sc, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ]));

    const breatheLoop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1.07, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(breathe, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));

    const r1 = ripple(r1Scale, r1Opacity, 0);
    const r2 = ripple(r2Scale, r2Opacity, 950);
    r1.start(); r2.start(); breatheLoop.start();

    const timer = setTimeout(() => {
      r1.stop(); r2.stop(); breatheLoop.stop();
      r1Opacity.setValue(0);
      r2Opacity.setValue(0);
      Animated.timing(breathe, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, 1500);

    return () => { clearTimeout(timer); r1.stop(); r2.stop(); breatheLoop.stop(); };
  }, [trigger]);

  const ringStyle = (sc: Animated.Value, op: Animated.Value) => ({
    position: 'absolute' as const,
    width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2,
    backgroundColor: C.accent,
    opacity: op, transform: [{ scale: sc }],
  });

  return (
    <View style={{ width: ICON_SIZE, height: ICON_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
      <Animated.View style={ringStyle(r1Scale, r1Opacity)} />
      <Animated.View style={ringStyle(r2Scale, r2Opacity)} />
      <Animated.View style={{ transform: [{ scale: entrance }] }}>
        <Animated.View style={{
          width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2,
          backgroundColor: C.accentSoft,
          justifyContent: 'center', alignItems: 'center',
          transform: [{ scale: breathe }],
        }}>
          <Ionicons name="checkmark-circle" size={42} color={C.accent} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const { preferredCurrency } = useCurrency();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  const totalBalance = balances.reduce((sum, b) => sum + parseFloat(b.amount), 0);

  async function load() {
    setError(false);
    try {
      const data = await getBalances();
      setBalances(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => {
    load();
    setFocusTick(t => t + 1);
  }, []));

  const firstName = (user?.name || user?.email || '').split(' ')[0].split('@')[0];
  const greet = `${greetingFor()}, ${firstName}!`;

  if (loading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <Ionicons name="warning-outline" size={48} color={C.warning} style={{ marginBottom: 12 }} />
        <Text style={styles.errorText}>Could not load balances</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setLoading(true); load(); }}
          activeOpacity={0.85}
        >
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const positiveTotal = totalBalance >= 0;
  const statusText =
    totalBalance > 0 ? 'You are owed money'
      : totalBalance < 0 ? 'You owe money'
      : 'All settled up!';

  return (
    <View style={styles.container}>
      <FlatList
        data={balances}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.greeting}>{greet}</Text>
              <Text style={styles.greetSub}>Here's your balance overview</Text>
            </View>

            <View style={styles.heroWrap}>
              <LinearGradient
                colors={[C.accent, C.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <Text style={styles.heroLabel}>
                  Total Balance · {preferredCurrency}
                </Text>
                <Text style={styles.heroAmount}>
                  {positiveTotal ? '+' : '-'}{fmt(Math.abs(totalBalance), preferredCurrency)}
                </Text>
                <Text style={styles.heroSub}>{statusText}</Text>
              </LinearGradient>
            </View>

            <Text style={styles.sectionTitle}>Balances</Text>

            {balances.length === 0 && (
              <View style={styles.emptyBox}>
                <SettledUpIcon C={C} trigger={focusTick} />
                <Text style={styles.emptyTitle}>All settled up!</Text>
                <Text style={styles.emptySub}>
                  Add expenses in a group to see who owes what.
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const amount = parseFloat(item.amount);
          const isPositive = amount > 0;
          return (
            <View style={[styles.balanceRow, S.shadowSm]}>
              <Avatar
                name={item.user.name}
                email={item.user.email}
                avatar={item.user.avatar}
                size={44}
                style={styles.avatarMargin}
              />
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceName}>
                  {item.user.name || item.user.email}
                </Text>
                <Text style={styles.balanceSub}>
                  {isPositive ? 'owes you' : 'you owe'}
                </Text>
              </View>
              <Text
                style={[
                  styles.balanceAmount,
                  { color: isPositive ? C.positive : C.negative },
                ]}
              >
                {isPositive ? '+' : '-'}
                {fmt(Math.abs(amount), item.currency ?? preferredCurrency)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    listContent: { paddingBottom: TAB_PAD },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    greeting: {
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: C.text,
    },
    greetSub: {
      fontSize: 15,
      color: C.textSecondary,
      marginTop: 4,
    },

    heroWrap: {
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 24,
      borderRadius: 24,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 8,
    },
    hero: {
      borderRadius: 24,
      padding: 28,
    },
    heroLabel: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    heroAmount: {
      color: '#fff',
      fontSize: 44,
      fontWeight: '800',
      letterSpacing: -1,
    },
    heroSub: {
      color: 'rgba(255,255,255,0.92)',
      fontSize: 15,
      marginTop: 6,
      fontWeight: '500',
    },

    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginLeft: 20,
    },

    emptyBox: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 32,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 6,
      color: C.text,
    },
    emptySub: {
      fontSize: 14,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    errorText: {
      fontSize: 17,
      fontWeight: '600',
      color: C.text,
      marginBottom: 20,
    },
    retryBtn: {
      backgroundColor: C.accent,
      borderRadius: 16,
      paddingHorizontal: 28,
      paddingVertical: 14,
    },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.bgElevated,
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    avatarMargin: { marginRight: 12 },
    balanceInfo: { flex: 1 },
    balanceName: {
      fontSize: 16,
      fontWeight: '600',
      color: C.text,
    },
    balanceSub: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 2,
    },
    balanceAmount: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
  });
}
