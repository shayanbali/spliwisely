import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions, Animated, Easing,
} from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import BackButton from '../components/common/BackButton';
import Avatar from '../components/common/Avatar';
import { getAnalytics, AnalyticsData, MemberSpending } from '../services/expenses';
import { fmt } from '../utils/currency';
import { S, ThemeColors } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_RADIUS = 90;
const CHART_HOLE   = 56;
const CHART_SIZE   = CHART_RADIUS * 2 + 20;
const PIE_COLORS   = ['#5E5CE6', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#0A84FF', '#FF6B00'];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function slicePath(cx: number, cy: number, R: number, r: number, start: number, end: number) {
  const clampedEnd = Math.min(end, start + 359.99);
  const o1 = polar(cx, cy, R, start);
  const o2 = polar(cx, cy, R, clampedEnd);
  const i1 = polar(cx, cy, r, clampedEnd);
  const i2 = polar(cx, cy, r, start);
  const large = clampedEnd - start > 180 ? 1 : 0;
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${R} ${R} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${r} ${r} 0 ${large} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
}

function DonutChart({ categories, progress, activeIdx, onSlicePress }: {
  categories: AnalyticsData['categories'];
  progress: number;
  activeIdx: number | null;
  onSlicePress: (i: number) => void;
}) {
  const cx = CHART_SIZE / 2;
  const cy = CHART_SIZE / 2;
  let cumulative = 0;
  return (
    <Svg width={CHART_SIZE} height={CHART_SIZE}>
      <G>
        {categories.map((cat, i) => {
          const pct      = cat.percentage * progress;
          const startDeg = cumulative * 3.6;
          const endDeg   = (cumulative + pct) * 3.6;
          cumulative    += pct;
          const isActive = activeIdx === i;
          const R        = isActive ? CHART_RADIUS + 7 : CHART_RADIUS;
          if (endDeg - startDeg < 0.01) return null;
          return (
            <Path
              key={i}
              d={slicePath(cx, cy, R, CHART_HOLE, startDeg, endDeg)}
              fill={PIE_COLORS[i % PIE_COLORS.length]}
              opacity={activeIdx !== null && !isActive ? 0.4 : 1}
              onPress={() => onSlicePress(i)}
            />
          );
        })}
        <Circle cx={cx} cy={cy} r={CHART_HOLE - 2} fill="transparent" />
      </G>
    </Svg>
  );
}

function BarChart({ periods, currency, progress, C }: {
  periods: AnalyticsData['periods'];
  currency: string;
  progress: number;
  C: ThemeColors;
}) {
  const BAR_MAX_H = 120;
  const vals = periods.map(p => parseFloat(p.total));
  const max  = Math.max(...vals, 0.01);
  return (
    <View style={{ height: BAR_MAX_H + 44, flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
      {periods.map((p, i) => {
        const targetH = Math.max((vals[i] / max) * BAR_MAX_H, 4);
        const animH   = targetH * progress;
        const isLast  = i === periods.length - 1;
        return (
          <View key={i} style={{ alignItems: 'center', flex: 1 }}>
            {progress > 0.6 && (
              <Text style={{ fontSize: 8, color: C.textMuted, marginBottom: 3 }}>
                {fmt(vals[i], currency).replace(/[^\d.,K]/g, '')}
              </Text>
            )}
            <View style={{
              width: '70%', height: animH, borderRadius: 6,
              backgroundColor: isLast ? C.accent : `${C.accent}66`,
            }} />
            <Text style={{ fontSize: 9, color: C.textSecondary, marginTop: 5, textAlign: 'center' }} numberOfLines={1}>
              {p.label.split(' ')[0]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function AnimCard({ anim, slide, children, style }: {
  anim: Animated.Value; slide: Animated.Value;
  children: React.ReactNode; style?: object;
}) {
  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY: slide }] }]}>
      {children}
    </Animated.View>
  );
}

const CARD_COUNT = 6;

export default function AnalyticsScreen({ navigation, route }: any) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  // Group passed from GroupDetailScreen
  const group = route?.params?.group ?? null;

  const [period, setPeriod]           = useState<'monthly' | 'weekly'>('monthly');
  const [data, setData]               = useState<AnalyticsData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  const fadeAnims  = useRef(Array.from({ length: CARD_COUNT }, () => new Animated.Value(0))).current;
  const slideAnims = useRef(Array.from({ length: CARD_COUNT }, () => new Animated.Value(28))).current;
  const [donutProg, setDonutProg] = useState(0);
  const [barProg,   setBarProg]   = useState(0);
  const donutAnim = useRef(new Animated.Value(0)).current;
  const barAnim   = useRef(new Animated.Value(0)).current;

  function runEntranceAnimations() {
    fadeAnims.forEach(a => a.setValue(0));
    slideAnims.forEach(a => a.setValue(28));
    setDonutProg(0);
    setBarProg(0);
    donutAnim.setValue(0);
    barAnim.setValue(0);

    Animated.stagger(
      90,
      fadeAnims.map((fade, i) =>
        Animated.parallel([
          Animated.spring(fade,          { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 7 }),
          Animated.spring(slideAnims[i], { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 7 }),
        ]),
      ),
    ).start();

    const donutId = donutAnim.addListener(({ value }) => setDonutProg(value));
    Animated.timing(donutAnim, {
      toValue: 1, duration: 1100, delay: 250,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start(() => donutAnim.removeListener(donutId));

    const barId = barAnim.addListener(({ value }) => setBarProg(value));
    Animated.timing(barAnim, {
      toValue: 1, duration: 750, delay: 180,
      easing: Easing.out(Easing.back(1.4)), useNativeDriver: false,
    }).start(() => barAnim.removeListener(barId));
  }

  async function load(p: 'monthly' | 'weekly') {
    setLoading(true);
    try {
      const d = await getAnalytics(p, group?.id);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(period); }, []));

  useEffect(() => {
    if (data) runEntranceAnimations();
  }, [data]);

  function switchPeriod(p: 'monthly' | 'weekly') {
    setPeriod(p);
    setActiveSlice(null);
    load(p);
  }

  const current  = parseFloat(data?.current_total  ?? '0');
  const previous = parseFloat(data?.previous_total ?? '0');
  const change   = data?.change_pct ?? null;
  const currency = data?.currency ?? 'USD';
  const activeCategory = activeSlice !== null ? data?.categories[activeSlice] : null;
  const memberSpending = data?.member_spending ?? [];

  const title = group ? group.name : 'Analytics';
  const subtitle = group ? 'Group Analytics' : null;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <AnimCard anim={fadeAnims[0]} slide={slideAnims[0]}>
          <View style={styles.header}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.headerTitle}>{title}</Text>
              {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
            </View>
            <View style={{ width: 60 }} />
          </View>
        </AnimCard>

        {/* Period toggle */}
        <AnimCard anim={fadeAnims[0]} slide={slideAnims[0]} style={{ marginHorizontal: 16, marginBottom: 20 }}>
          <View style={styles.toggleWrap}>
            {(['monthly', 'weekly'] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}
                onPress={() => switchPeriod(p)}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>
                  {p === 'monthly' ? 'Monthly' : 'Weekly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </AnimCard>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : !data || data.periods.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="bar-chart-outline" size={48} color={C.textMuted} />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySub}>
              {group
                ? 'Add expenses to this group to see its analytics.'
                : 'Add expenses to start seeing your spending analytics.'}
            </Text>
          </View>
        ) : (
          <>
            {/* Summary cards */}
            <AnimCard anim={fadeAnims[1]} slide={slideAnims[1]} style={{ marginHorizontal: 16, marginBottom: 14 }}>
              <View style={styles.summaryRow}>
                <LinearGradient colors={[C.accent, C.accentDark]} style={[styles.summaryCard, S.shadowSm]}>
                  <Text style={styles.summaryLabel}>
                    {period === 'monthly' ? 'This Month' : 'This Week'}
                  </Text>
                  <Text style={styles.summaryAmount}>{fmt(current, currency)}</Text>
                  {change !== null && (
                    <View style={styles.changePill}>
                      <Ionicons
                        name={change >= 0 ? 'trending-up' : 'trending-down'}
                        size={12}
                        color={change >= 0 ? '#FFD60A' : '#30D158'}
                      />
                      <Text style={[styles.changeText, { color: change >= 0 ? '#FFD60A' : '#30D158' }]}>
                        {change >= 0 ? '+' : ''}{change}% vs last {period === 'monthly' ? 'month' : 'week'}
                      </Text>
                    </View>
                  )}
                </LinearGradient>

                <View style={[styles.summaryCardSmall, S.shadowSm]}>
                  <Text style={styles.summaryLabelDark}>
                    {period === 'monthly' ? 'Last Month' : 'Last Week'}
                  </Text>
                  <Text style={styles.summaryAmountDark}>{fmt(previous, currency)}</Text>
                  <Text style={styles.summaryHint}>previous period</Text>
                </View>
              </View>
            </AnimCard>

            {/* Bar chart */}
            <AnimCard anim={fadeAnims[2]} slide={slideAnims[2]} style={[styles.card, S.shadowSm, { marginHorizontal: 16, marginBottom: 14 }]}>
              <Text style={styles.cardTitle}>Spending History</Text>
              <BarChart periods={data.periods} currency={currency} progress={barProg} C={C} />
            </AnimCard>

            {/* Donut chart */}
            <AnimCard anim={fadeAnims[3]} slide={slideAnims[3]} style={[styles.card, S.shadowSm, { marginHorizontal: 16, marginBottom: 14 }]}>
              <Text style={styles.cardTitle}>Spending by Category</Text>
              <View style={styles.donutWrap}>
                <View>
                  <DonutChart
                    categories={data.categories}
                    progress={donutProg}
                    activeIdx={activeSlice}
                    onSlicePress={i => setActiveSlice(activeSlice === i ? null : i)}
                  />
                  <View style={styles.donutCenter} pointerEvents="none">
                    {activeCategory ? (
                      <>
                        <Text style={styles.donutPct}>{activeCategory.percentage}%</Text>
                        <Text style={styles.donutCatLabel} numberOfLines={2}>{activeCategory.label}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.donutPct}>{Math.round(donutProg * 100)}%</Text>
                        <Text style={styles.donutCatLabel}>All</Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={styles.legend}>
                  {data.categories.map((cat, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.legendRow, activeSlice === i && styles.legendRowActive]}
                      onPress={() => setActiveSlice(activeSlice === i ? null : i)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.legendDot, { backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.legendLabel} numberOfLines={1}>{cat.label}</Text>
                        <Text style={styles.legendAmt}>{fmt(parseFloat(cat.total), currency)}</Text>
                      </View>
                      <Text style={styles.legendPct}>{cat.percentage}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </AnimCard>

            {/* Member spending (group mode only) */}
            {group && memberSpending.length > 0 && (
              <AnimCard anim={fadeAnims[4]} slide={slideAnims[4]} style={[styles.card, S.shadowSm, { marginHorizontal: 16, marginBottom: 14 }]}>
                <Text style={styles.cardTitle}>Member Spending</Text>
                {memberSpending.map((m, i) => (
                  <View key={i} style={styles.memberRow}>
                    <Avatar
                      name={m.user.name}
                      email={m.user.email}
                      avatar={m.user.avatar}
                      size={36}
                      style={{ marginRight: 12 }}
                    />
                    <View style={{ flex: 1, gap: 5 }}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.user.name || m.user.email}
                        </Text>
                        <Text style={[styles.memberPct, { color: PIE_COLORS[i % PIE_COLORS.length] }]}>
                          {m.percentage}%
                        </Text>
                      </View>
                      <View style={styles.memberBarTrack}>
                        <View style={[
                          styles.memberBarFill,
                          {
                            width: `${m.percentage * barProg}%`,
                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          },
                        ]} />
                      </View>
                    </View>
                    <Text style={styles.memberAmt}>{fmt(parseFloat(m.amount), currency)}</Text>
                  </View>
                ))}
              </AnimCard>
            )}

            {/* Period breakdown */}
            <AnimCard
              anim={fadeAnims[group ? 5 : 4]}
              slide={slideAnims[group ? 5 : 4]}
              style={[styles.card, S.shadowSm, { marginHorizontal: 16, marginBottom: 14 }]}
            >
              <Text style={styles.cardTitle}>Period Breakdown</Text>
              {[...data.periods].reverse().map((p, i) => {
                const isFirst = i === 0;
                const val     = parseFloat(p.total);
                const maxVal  = Math.max(...data.periods.map(x => parseFloat(x.total)), 0.01);
                const barPct  = (val / maxVal) * barProg;
                return (
                  <View key={i} style={styles.periodRow}>
                    <Text style={[styles.periodLabel, isFirst && { color: C.accent, fontWeight: '700' }]}>
                      {p.label}
                    </Text>
                    <View style={styles.periodBarTrack}>
                      <View style={[
                        styles.periodBarFill,
                        { width: `${barPct * 100}%`, backgroundColor: isFirst ? C.accent : `${C.accent}66` },
                      ]} />
                    </View>
                    <Text style={[styles.periodAmt, isFirst && { color: C.accent }]}>
                      {fmt(val, currency)}
                    </Text>
                  </View>
                );
              })}
            </AnimCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 48 },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 14,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
    headerSubtitle: { fontSize: 11, color: C.textSecondary, marginTop: 1 },

    toggleWrap: {
      flexDirection: 'row',
      backgroundColor: C.inputFill,
      borderRadius: 14,
      padding: 3,
    },
    toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
    toggleBtnActive: {
      backgroundColor: C.bgElevated,
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    },
    toggleText: { fontSize: 14, fontWeight: '600', color: C.textSecondary },
    toggleTextActive: { color: C.accent },

    loadingBox: { paddingTop: 80, alignItems: 'center' },
    emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    emptySub: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },

    summaryRow: { flexDirection: 'row', gap: 10 },
    summaryCard: { flex: 1, borderRadius: 20, padding: 18 },
    summaryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.78)', fontWeight: '600', marginBottom: 6 },
    summaryAmount: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
    changePill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    changeText: { fontSize: 12, fontWeight: '600' },
    summaryCardSmall: {
      flex: 1, borderRadius: 20, padding: 16,
      backgroundColor: C.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
      justifyContent: 'center',
    },
    summaryLabelDark: { fontSize: 11, color: C.textSecondary, fontWeight: '600', marginBottom: 6 },
    summaryAmountDark: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
    summaryHint: { fontSize: 11, color: C.textMuted, marginTop: 4 },

    card: {
      backgroundColor: C.bgElevated,
      borderRadius: 20,
      padding: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 16 },

    donutWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    donutCenter: {
      position: 'absolute',
      width: CHART_SIZE, height: CHART_SIZE,
      alignItems: 'center', justifyContent: 'center',
    },
    donutPct: { fontSize: 22, fontWeight: '800', color: C.text },
    donutCatLabel: {
      fontSize: 11, color: C.textSecondary,
      textAlign: 'center', maxWidth: CHART_HOLE * 1.6,
    },

    legend: { flex: 1, gap: 4 },
    legendRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 5, paddingHorizontal: 6, borderRadius: 10,
    },
    legendRowActive: { backgroundColor: C.accentSoft },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: 12, fontWeight: '600', color: C.text },
    legendAmt: { fontSize: 11, color: C.textSecondary },
    legendPct: { fontSize: 12, fontWeight: '700', color: C.textSecondary, minWidth: 34, textAlign: 'right' },

    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    memberNameRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    memberName: { fontSize: 13, fontWeight: '600', color: C.text, flex: 1 },
    memberPct: { fontSize: 12, fontWeight: '700', marginLeft: 8 },
    memberBarTrack: {
      height: 6, borderRadius: 3,
      backgroundColor: C.inputFill,
      overflow: 'hidden',
    },
    memberBarFill: { height: '100%', borderRadius: 3 },
    memberAmt: { fontSize: 13, fontWeight: '700', color: C.text, marginLeft: 12, minWidth: 64, textAlign: 'right' },

    periodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    periodLabel: { fontSize: 13, color: C.textSecondary, width: 68 },
    periodBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.inputFill, overflow: 'hidden' },
    periodBarFill: { height: '100%', borderRadius: 4 },
    periodAmt: { fontSize: 13, fontWeight: '700', color: C.text, width: 72, textAlign: 'right' },
  });
}
