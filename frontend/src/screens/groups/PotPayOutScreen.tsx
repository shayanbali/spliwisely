import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { createPotTransaction } from '../../services/groups';
import BackButton from '../../components/common/BackButton';
import Avatar from '../../components/common/Avatar';
import { fmt } from '../../utils/currency';
import { S, ThemeColors } from '../../theme';
import { Group } from '../../types';

export default function PotPayOutScreen({ route, navigation }: any) {
  const { group, potBalance, currency, onDone }: { group: Group; potBalance: string; currency: string; onDone?: () => void } = route.params;
  const { user } = useAuth();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const otherMembers = group.members.filter(m => m.user.id !== user?.id);

  const [selectedMember, setSelectedMember] = useState<typeof otherMembers[0] | null>(
    otherMembers.length === 1 ? otherMembers[0] : null
  );
  const [amount, setAmount] = useState(potBalance ?? '0');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePayout() {
    if (!selectedMember) {
      Alert.alert('Select recipient', 'Please choose who receives the payout.');
      return;
    }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid payout amount.');
      return;
    }
    setLoading(true);
    try {
      await createPotTransaction(group.id, {
        user_id: selectedMember.user.id,
        transaction_type: 'payout',
        amount: parsed,
        currency,
        note: note.trim(),
      });
      onDone?.();
      navigation.goBack();
      Alert.alert('Payout recorded!', `${fmt(parsed, currency)} paid out to ${selectedMember.user.name || selectedMember.user.email}.`);
    } catch {
      Alert.alert('Error', 'Could not record payout.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Pay Out</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Pot balance card */}
        <LinearGradient
          colors={['#BF5AF2', '#7B2FBE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.balanceCard, S.shadowSm]}
        >
          <Text style={styles.balanceLabel}>Current Pot Balance</Text>
          <Text style={styles.balanceAmount}>{fmt(parseFloat(potBalance ?? '0'), currency)}</Text>
          <Text style={styles.balanceSub}>{currency} available to pay out</Text>
        </LinearGradient>

        {/* Select recipient */}
        <Text style={styles.sectionLabel}>Select Recipient</Text>
        {otherMembers.length === 0 ? (
          <View style={[styles.card, styles.emptyRecipients]}>
            <Ionicons name="people-outline" size={28} color={C.textMuted} />
            <Text style={styles.emptyRecipientsText}>No other members in this group.</Text>
          </View>
        ) : (
          <View style={[styles.card, S.shadowSm]}>
            {otherMembers.map((m, i) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.memberRow,
                  i < otherMembers.length - 1 && styles.memberBorder,
                  selectedMember?.id === m.id && styles.memberRowSelected,
                ]}
                onPress={() => setSelectedMember(m)}
                activeOpacity={0.7}
              >
                <Avatar
                  name={m.user.name}
                  email={m.user.email}
                  avatar={m.user.avatar}
                  size={40}
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.memberName}>{m.user.name || m.user.email}</Text>
                {selectedMember?.id === m.id && (
                  <Ionicons name="checkmark-circle" size={22} color={C.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Amount */}
        <Text style={styles.sectionLabel}>Payout Amount</Text>
        <View style={[styles.amountRow, S.shadowSm]}>
          <Text style={styles.currencySymbol}>{currency}</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={C.placeholder}
          />
        </View>

        {/* Note */}
        <Text style={styles.sectionLabel}>Note (optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Tournament winner"
          placeholderTextColor={C.placeholder}
          returnKeyType="done"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.payoutBtn, (!selectedMember || loading) && { opacity: 0.6 }]}
          onPress={handlePayout}
          disabled={!selectedMember || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : (
              <>
                <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
                <Text style={styles.payoutBtnText}>Record Payout</Text>
              </>
            )
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 14,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },

    scrollContent: { padding: 16, paddingBottom: 40 },

    balanceCard: {
      borderRadius: 20,
      padding: 20,
      marginBottom: 24,
      alignItems: 'center',
    },
    balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 6 },
    balanceAmount: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1 },
    balanceSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginLeft: 4,
      marginTop: 8,
    },

    card: {
      backgroundColor: C.bgElevated,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
      marginBottom: 16,
    },
    emptyRecipients: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 8,
    },
    emptyRecipientsText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },

    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    memberRowSelected: { backgroundColor: C.accentSoft },
    memberBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator },
    memberName: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },

    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.bgElevated,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 4,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    currencySymbol: { fontSize: 18, fontWeight: '700', color: C.textSecondary, marginRight: 8 },
    amountInput: {
      flex: 1,
      fontSize: 28,
      fontWeight: '700',
      color: C.text,
      paddingVertical: 12,
    },

    noteInput: {
      backgroundColor: C.bgElevated,
      borderRadius: 14,
      padding: 14,
      fontSize: 15,
      color: C.text,
      marginBottom: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.8)',
    },

    payoutBtn: {
      backgroundColor: '#BF5AF2',
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#BF5AF2',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 5,
    },
    payoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
