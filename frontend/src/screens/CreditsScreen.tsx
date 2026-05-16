import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated, Easing, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BackButton from '../components/common/BackButton';
import Avatar from '../components/common/Avatar';
import BottomModal from '../components/common/BottomModal';
import { getCreditTransactions, topUpDemo } from '../services/credits';
import api from '../services/api';
import { CreditTransaction } from '../types';
import { S, ThemeColors } from '../theme';

const PRESET_AMOUNTS = [10, 25, 50, 100, 200];

const HOW_IT_WORKS = [
  {
    icon: 'wallet-outline' as const,
    color: '#5E5CE6',
    title: 'Top up your wallet',
    desc: 'Add Splitwise Credits in seconds — no bank details needed.',
    animType: 'bounce' as const,
  },
  {
    icon: 'flash-outline' as const,
    color: '#FF9F0A',
    title: 'Settle instantly',
    desc: 'Pay off debts with one tap. Credits transfer in real-time.',
    animType: 'flash' as const,
  },
  {
    icon: 'swap-horizontal-outline' as const,
    color: '#30D158',
    title: 'Always in sync',
    desc: 'Both sides see the balance update immediately after a transfer.',
    animType: 'spin' as const,
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Shimmer + breathe + press "Add Credits" button
function PulseButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const press   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Shimmer sweeps left→right every ~3 seconds
    const shimmerLoop = Animated.loop(Animated.sequence([
      Animated.delay(2800),
      Animated.timing(shimmer, {
        toValue: 1, duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));

    const breatheLoop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1.05, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 1,    duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));

    shimmerLoop.start();
    breatheLoop.start();
    return () => { shimmerLoop.stop(); breatheLoop.stop(); };
  }, []);

  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-180, 220] });

  function onPressIn() {
    Animated.spring(press, { toValue: 0.93, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  }
  function onPressOut() {
    Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 12 }).start();
  }

  return (
    <Animated.View style={{ alignSelf: 'flex-start', transform: [{ scale: Animated.multiply(breathe, press) }] }}>
      <TouchableOpacity
        style={{
          backgroundColor: '#fff',
          borderRadius: 22,
          paddingHorizontal: 22,
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          overflow: 'hidden',
        }}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={loading}
        activeOpacity={1}
      >
        {/* Shimmer streak */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, bottom: 0, width: 70,
            transform: [{ translateX: shimmerX }, { skewX: '-18deg' }],
          }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(160,150,255,0.35)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {loading ? (
          <ActivityIndicator color="#5E5CE6" size="small" />
        ) : (
          <>
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: 'rgba(94,92,230,0.12)',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Ionicons name="add" size={14} color="#5E5CE6" />
            </View>
            <Text style={{ color: '#5E5CE6', fontWeight: '800', fontSize: 15 }}>Add Credits</Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// Animated step card for "How it works"
function StepCard({ step, anim, slide }: {
  step: typeof HOW_IT_WORKS[0];
  anim: Animated.Value;
  slide: Animated.Value;
}) {
  const { C } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const expandAnim  = useRef(new Animated.Value(0)).current;
  const iconScale   = useRef(new Animated.Value(1)).current;
  const iconRotate  = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  function playIconAnim() {
    if (step.animType === 'bounce') {
      iconScale.setValue(1);
      Animated.sequence([
        Animated.spring(iconScale, { toValue: 1.45, useNativeDriver: true, speed: 120, bounciness: 18 }),
        Animated.spring(iconScale, { toValue: 1,    useNativeDriver: true, speed: 80,  bounciness: 10 }),
      ]).start();

    } else if (step.animType === 'flash') {
      flashOpacity.setValue(0);
      iconScale.setValue(1);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 0.55, duration: 100, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0,    duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.spring(iconScale, { toValue: 1.4, useNativeDriver: true, speed: 120, bounciness: 14 }),
          Animated.spring(iconScale, { toValue: 1,   useNativeDriver: true, speed: 80,  bounciness: 8 }),
        ]),
      ]).start();

    } else if (step.animType === 'spin') {
      iconRotate.setValue(0);
      Animated.timing(iconRotate, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => iconRotate.setValue(0));
    }
  }

  function toggle() {
    playIconAnim();
    setExpanded(e => {
      Animated.timing(expandAnim, {
        toValue: e ? 0 : 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return !e;
    });
  }

  const descHeight  = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 40] });
  const descOpacity = expandAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const spinDeg     = iconRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 4 }}
      >
        {/* Icon circle with scale + flash overlay */}
        <Animated.View style={{
          width: 36, height: 36, borderRadius: 10,
          justifyContent: 'center', alignItems: 'center',
          backgroundColor: `${step.color}18`,
          transform: [{ scale: iconScale }],
          overflow: 'hidden',
        }}>
          {/* Flash overlay for lightning animType */}
          {step.animType === 'flash' && (
            <Animated.View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: step.color,
              borderRadius: 10,
              opacity: flashOpacity,
            }} />
          )}
          {/* Spin wrapper for swap animType */}
          <Animated.View style={step.animType === 'spin' ? { transform: [{ rotate: spinDeg }] } : undefined}>
            <Ionicons name={step.icon} size={18} color={step.color} />
          </Animated.View>
        </Animated.View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{step.title}</Text>
          <Animated.View style={{ height: descHeight, overflow: 'hidden', opacity: descOpacity }}>
            <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 3, lineHeight: 17 }}>{step.desc}</Text>
          </Animated.View>
        </View>
        <Animated.View style={{
          transform: [{
            rotate: expandAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
          }],
        }}>
          <Ionicons name="chevron-down" size={16} color={C.textMuted} />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CreditsScreen({ navigation }: any) {
  const { user, setUser } = useAuth();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [toppingUp, setToppingUp]       = useState(false);
  const [topUpModal, setTopUpModal]     = useState(false);
  const [selectedAmt, setSelectedAmt]   = useState<number>(100);
  const [customAmt, setCustomAmt]       = useState('');
  const [useCustom, setUseCustom]       = useState(false);

  // Entrance animations
  const cardAnim  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(32)).current;
  const howAnims  = useRef(HOW_IT_WORKS.map(() => new Animated.Value(0))).current;
  const howSlides = useRef(HOW_IT_WORKS.map(() => new Animated.Value(20))).current;

  function runEntrance() {
    cardAnim.setValue(0); cardSlide.setValue(32);
    howAnims.forEach(a => a.setValue(0));
    howSlides.forEach(a => a.setValue(20));

    Animated.parallel([
      Animated.spring(cardAnim,  { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }),
      Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 8 }),
    ]).start();

    Animated.stagger(80, howAnims.map((a, i) =>
      Animated.parallel([
        Animated.spring(a,           { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 6 }),
        Animated.spring(howSlides[i], { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 6 }),
      ]),
    )).start();
  }

  async function load() {
    try {
      const [txns, meRes] = await Promise.all([
        getCreditTransactions(),
        api.get('/auth/me/'),
      ]);
      setTransactions(txns);
      setUser(meRes.data);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => {
    load();
    runEntrance();
  }, []));

  async function handleTopUp() {
    const amount = useCustom ? parseFloat(customAmt) : selectedAmt;
    if (!amount || isNaN(amount) || amount <= 0) return;
    setToppingUp(true);
    setTopUpModal(false);
    try {
      await topUpDemo(amount);
      await load();
    } catch {
      // silently fail
    } finally {
      setToppingUp(false);
    }
  }

  const balance = parseFloat(user?.credits_balance ?? '0');

  function txIcon(type: CreditTransaction['transaction_type']) {
    if (type === 'topup')       return { name: 'add-circle'        as const, color: C.positive };
    if (type === 'transfer_in') return { name: 'arrow-down-circle' as const, color: C.positive };
    return                             { name: 'arrow-up-circle'   as const, color: C.negative };
  }

  function txLabel(tx: CreditTransaction) {
    if (tx.transaction_type === 'topup') return 'Credits added';
    const who = tx.counterpart?.name || tx.counterpart?.email || 'Someone';
    return tx.transaction_type === 'transfer_in' ? `Received from ${who}` : `Sent to ${who}`;
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
            {/* Header */}
            <View style={styles.header}>
              <BackButton onPress={() => navigation.goBack()} />
              <Text style={styles.headerTitle}>Splitwise Credits</Text>
              <View style={{ width: 60 }} />
            </View>

            {/* Balance card */}
            <Animated.View style={[{ opacity: cardAnim, transform: [{ translateY: cardSlide }] }]}>
              <LinearGradient
                colors={['#5E5CE6', '#BF5AF2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.balanceCard, S.shadowSm]}
              >
                <Text style={styles.balanceLabel}>Your Balance</Text>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceAmount}>{balance.toFixed(2)}</Text>
                  <Text style={styles.balanceCurrency}>SC</Text>
                </View>
                <Text style={styles.balanceSub}>Splitwise Credits · settle debts instantly</Text>

                <PulseButton onPress={() => setTopUpModal(true)} loading={toppingUp} />
              </LinearGradient>
            </Animated.View>

            {/* How it works */}
            <View style={[styles.infoCard, S.shadowSm]}>
              <Text style={styles.infoTitle}>How Credits Work</Text>
              {HOW_IT_WORKS.map((step, i) => (
                <StepCard
                  key={i}
                  step={step}
                  anim={howAnims[i]}
                  slide={howSlides[i]}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>Transaction History</Text>

            {transactions.length === 0 && (
              <View style={styles.emptyBox}>
                <Ionicons name="receipt-outline" size={40} color={C.textMuted} />
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySub}>Add credits or settle a debt to see history here.</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const icon = txIcon(item.transaction_type);
          const isIncoming = item.transaction_type !== 'transfer_out';
          return (
            <View style={[styles.txRow, S.shadowSm]}>
              {item.counterpart ? (
                <Avatar
                  name={item.counterpart.name}
                  email={item.counterpart.email}
                  avatar={item.counterpart.avatar}
                  size={42}
                  style={{ marginRight: 12 }}
                />
              ) : (
                <View style={[styles.txIconWrap, { marginRight: 12 }]}>
                  <Ionicons name={icon.name} size={24} color={icon.color} />
                </View>
              )}
              <View style={styles.txInfo}>
                <Text style={styles.txLabel}>{txLabel(item)}</Text>
                {item.note ? (
                  <Text style={styles.txNote} numberOfLines={1}>{item.note}</Text>
                ) : (
                  <Text style={styles.txNote}>{formatDate(item.created_at)}</Text>
                )}
                {item.note ? <Text style={styles.txDate}>{formatDate(item.created_at)}</Text> : null}
              </View>
              <Text style={[styles.txAmount, { color: isIncoming ? C.positive : C.negative }]}>
                {isIncoming ? '+' : '-'}{parseFloat(item.amount).toFixed(2)} SC
              </Text>
            </View>
          );
        }}
      />

      {/* Top-up picker modal */}
      <BottomModal visible={topUpModal} onClose={() => setTopUpModal(false)}>
        <Text style={styles.modalTitle}>Add Credits</Text>
        <Text style={styles.modalSub}>Select an amount to add to your wallet</Text>

        {/* Preset chips */}
        <View style={styles.amtGrid}>
          {PRESET_AMOUNTS.map(amt => {
            const active = !useCustom && selectedAmt === amt;
            return (
              <TouchableOpacity
                key={amt}
                style={[styles.amtChip, active && styles.amtChipActive]}
                onPress={() => { setSelectedAmt(amt); setUseCustom(false); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.amtChipText, active && styles.amtChipTextActive]}>
                  {amt} SC
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.amtChip, useCustom && styles.amtChipActive]}
            onPress={() => setUseCustom(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.amtChipText, useCustom && styles.amtChipTextActive]}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* Custom input */}
        {useCustom && (
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              value={customAmt}
              onChangeText={setCustomAmt}
              placeholder="Enter amount (max 500)"
              placeholderTextColor={C.placeholder}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.customUnit}>SC</Text>
          </View>
        )}

        {/* Preview */}
        {!useCustom && (
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>You will receive</Text>
            <LinearGradient
              colors={['#5E5CE6', '#BF5AF2']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.previewBadge}
            >
              <Text style={styles.previewAmt}>+{selectedAmt}.00 SC</Text>
            </LinearGradient>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.confirmBtn,
            (useCustom && (!customAmt || isNaN(parseFloat(customAmt)) || parseFloat(customAmt) <= 0)) && { opacity: 0.5 },
          ]}
          onPress={handleTopUp}
          disabled={toppingUp}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmBtnText}>
            Add {useCustom ? (customAmt || '0') : selectedAmt} SC to Wallet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setTopUpModal(false)} style={{ paddingVertical: 8 }}>
          <Text style={[styles.cancelText, { color: C.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </BottomModal>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    listContent: { paddingBottom: 40 },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 14,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },

    balanceCard: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 24,
      padding: 24,
    },
    balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 8 },
    balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
    balanceAmount: { fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: -2, lineHeight: 58 },
    balanceCurrency: { fontSize: 22, fontWeight: '700', color: 'rgba(255,255,255,0.75)', paddingBottom: 8 },
    balanceSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20 },
    infoCard: {
      marginHorizontal: 16,
      marginBottom: 24,
      backgroundColor: C.bgElevated,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    infoTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },

    sectionTitle: {
      fontSize: 12, fontWeight: '700', color: C.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.6,
      marginLeft: 20, marginBottom: 10,
    },

    emptyBox: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 32, gap: 8 },
    emptyText: { fontSize: 17, fontWeight: '600', color: C.text },
    emptySub: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },

    txRow: {
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
    txIconWrap: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: C.accentSoft,
      justifyContent: 'center', alignItems: 'center',
    },
    txInfo: { flex: 1 },
    txLabel: { fontSize: 15, fontWeight: '600', color: C.text },
    txNote: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    txDate: { fontSize: 11, color: C.textMuted, marginTop: 1 },
    txAmount: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },

    // Modal
    modalTitle: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
    modalSub: { fontSize: 14, color: C.textSecondary, marginBottom: 20 },
    amtGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 18,
    },
    amtChip: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: C.inputFill,
    },
    amtChipActive: { backgroundColor: C.accent },
    amtChipText: { fontSize: 14, fontWeight: '700', color: C.text },
    amtChipTextActive: { color: '#fff' },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.inputFill,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 4,
      marginBottom: 16,
    },
    customInput: {
      flex: 1, fontSize: 24, fontWeight: '700', color: C.text,
      paddingVertical: 10,
    },
    customUnit: { fontSize: 16, fontWeight: '700', color: C.textSecondary },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      paddingHorizontal: 4,
    },
    previewLabel: { fontSize: 14, color: C.textSecondary, fontWeight: '500' },
    previewBadge: {
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6,
    },
    previewAmt: { color: '#fff', fontWeight: '800', fontSize: 16 },
    confirmBtn: {
      backgroundColor: C.accent,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      marginBottom: 8,
    },
    confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    cancelText: { textAlign: 'center', fontSize: 15, fontWeight: '600' },
  });
}
