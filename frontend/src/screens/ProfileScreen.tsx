import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/common/Avatar';
import BottomModal from '../components/common/BottomModal';
import api from '../services/api';
import { CURRENCIES, symbolOf } from '../utils/currency';
import { S, TAB_PAD, ThemeColors, THEME_META, ThemeKey, THEMES } from '../theme';

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound',
  CAD: 'Canadian Dollar', AUD: 'Australian Dollar', JPY: 'Japanese Yen',
  CHF: 'Swiss Franc', CNY: 'Chinese Yuan', INR: 'Indian Rupee',
};

export default function ProfileScreen({ navigation }: any) {
  const { user, setUser, logout } = useAuth();
  const { C, themeKey, setTheme } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user?.name ?? '');
  const [preferredCurrency, setPreferredCurrency] = useState(user?.preferred_currency ?? 'USD');
  const [saving, setSaving] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [nameSheetVisible, setNameSheetVisible] = useState(false);
  const [usernameSheetVisible, setUsernameSheetVisible] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user?.username ?? '');
  const [savingUsername, setSavingUsername] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [themeSheetVisible, setThemeSheetVisible] = useState(false);
  const [pwSheetVisible, setPwSheetVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('avatar', { uri: asset.uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
      const { data } = await api.patch('/auth/me/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser(data);
    } catch {
      Alert.alert('Error', 'Could not upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveCurrency(c: string) {
    setPreferredCurrency(c);
    setSavingCurrency(true);
    try {
      const { data } = await api.patch('/auth/me/', { preferred_currency: c });
      setUser(data);
    } catch {
      Alert.alert('Error', 'Could not update currency preference.');
    } finally {
      setSavingCurrency(false);
    }
  }

  async function handleSaveName() {
    if (!name.trim() || name === user?.name) return;
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/me/', { name: name.trim() });
      setUser(data);
      setNameSheetVisible(false);
    } catch {
      Alert.alert('Error', 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  }

  function openNameSheet() {
    setName(user?.name ?? '');
    setNameSheetVisible(true);
  }

  function openUsernameSheet() {
    setUsernameInput(user?.username ?? '');
    setUsernameSheetVisible(true);
  }

  async function handleSaveUsername() {
    const trimmed = usernameInput.trim().toLowerCase();
    if (!trimmed || trimmed === user?.username) return;
    setSavingUsername(true);
    try {
      const { data } = await api.patch('/auth/me/', { username: trimmed });
      setUser(data);
      setUsernameSheetVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.username?.[0] ?? 'Could not update username.');
    } finally {
      setSavingUsername(false);
    }
  }

  function openPwSheet() {
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false);
    setPwSheetVisible(true);
  }

  async function handleChangePassword() {
    if (!currentPw || !newPw || !confirmPw) return;
    if (newPw !== confirmPw) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters.');
      return;
    }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password/', {
        current_password: currentPw,
        new_password: newPw,
        confirm_password: confirmPw,
      });
      setPwSheetVisible(false);
      Alert.alert('Success', 'Password changed successfully.');
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? 'Could not change password.';
      Alert.alert('Error', msg);
    } finally {
      setSavingPw(false);
    }
  }

  const nameDirty = name.trim().length > 0 && name.trim() !== user?.name;
  const usernameDirty = usernameInput.trim().length > 0 && usernameInput.trim() !== user?.username;
  const pwReady = currentPw.length > 0 && newPw.length >= 8 && confirmPw.length > 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ── */}
        <Text style={styles.pageTitle}>Profile</Text>

        {/* ── User card ── */}
        <TouchableOpacity
          style={[styles.userCard, S.shadow]}
          onPress={openNameSheet}
          activeOpacity={0.85}
        >
          <TouchableOpacity
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            activeOpacity={0.8}
            style={styles.avatarBtn}
          >
            <Avatar name={user?.name} email={user?.email} avatar={user?.avatar} size={68} fontSize={26} />
            <View style={styles.cameraOverlay}>
              {uploadingAvatar
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="camera" size={13} color="#fff" />
              }
            </View>
          </TouchableOpacity>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Set Name'}</Text>
            {user?.username ? (
              <Text style={styles.userHandle}>@{user.username}</Text>
            ) : null}
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={C.chevron} />
        </TouchableOpacity>

        {/* ── Preferences ── */}
        <Text style={styles.sectionHeader}>Preferences</Text>
        <View style={[styles.card, S.shadowSm]}>

          <TouchableOpacity style={styles.row} onPress={() => setCurrencyPickerVisible(true)} activeOpacity={0.75}>
            <View style={[styles.iconBadge, { backgroundColor: C.accent }]}>
              <Text style={styles.badgeCurrencyText}>{symbolOf(preferredCurrency).trim()}</Text>
            </View>
            <Text style={styles.rowLabel}>Currency</Text>
            <View style={styles.rowRight}>
              {savingCurrency
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Text style={styles.rowValue}>{preferredCurrency}</Text>
              }
              <Ionicons name="chevron-forward" size={15} color={C.chevron} />
            </View>
          </TouchableOpacity>

          <View style={styles.rowSep} />

          <TouchableOpacity style={styles.row} onPress={() => setThemeSheetVisible(true)} activeOpacity={0.75}>
            <View style={[styles.iconBadge, { backgroundColor: '#8E44AD' }]}>
              <Ionicons name="color-palette-outline" size={16} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>Appearance</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{THEME_META[themeKey].emoji} {THEME_META[themeKey].label}</Text>
              <Ionicons name="chevron-forward" size={15} color={C.chevron} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Credits ── */}
        <Text style={styles.sectionHeader}>Wallet</Text>
        <TouchableOpacity
          style={[styles.creditsCard, S.shadowSm]}
          onPress={() => navigation.navigate('Credits')}
          activeOpacity={0.85}
        >
          <View style={styles.creditsLeft}>
            <View style={[styles.iconBadge, { backgroundColor: '#5E5CE6' }]}>
              <Ionicons name="wallet-outline" size={16} color="#fff" />
            </View>
            <View>
              <Text style={styles.creditsLabel}>Splitwise Credits</Text>
              <Text style={styles.creditsSub}>Use to settle debts instantly</Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.creditsBalance}>
              {parseFloat(user?.credits_balance ?? '0').toFixed(2)} SC
            </Text>
            <Ionicons name="chevron-forward" size={15} color={C.chevron} />
          </View>
        </TouchableOpacity>

        {/* ── Account ── */}
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={[styles.card, S.shadowSm]}>
          <TouchableOpacity style={styles.row} onPress={openUsernameSheet} activeOpacity={0.75}>
            <View style={[styles.iconBadge, { backgroundColor: '#5856D6' }]}>
              <Ionicons name="at-outline" size={16} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>Username</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>@{user?.username}</Text>
              <Ionicons name="chevron-forward" size={15} color={C.chevron} />
            </View>
          </TouchableOpacity>

          <View style={styles.rowSep} />

          <TouchableOpacity style={styles.row} onPress={openPwSheet} activeOpacity={0.75}>
            <View style={[styles.iconBadge, { backgroundColor: '#3478F6' }]}>
              <Ionicons name="key-outline" size={16} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>Change Password</Text>
            <View style={styles.rowRight}>
              <Ionicons name="chevron-forward" size={15} color={C.chevron} />
            </View>
          </TouchableOpacity>

          <View style={styles.rowSep} />

          <TouchableOpacity style={styles.row} onPress={logout} activeOpacity={0.75}>
            <View style={[styles.iconBadge, { backgroundColor: C.negative }]}>
              <Ionicons name="log-out-outline" size={16} color="#fff" />
            </View>
            <Text style={[styles.rowLabel, { color: C.negative }]}>Log Out</Text>
            <View style={styles.rowRight}>
              <Ionicons name="chevron-forward" size={15} color={C.chevron} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Name edit sheet ── */}
      <BottomModal
        visible={nameSheetVisible}
        onClose={() => setNameSheetVisible(false)}
      >
        <Text style={styles.sheetTitle}>Display Name</Text>
        <TextInput
          style={styles.sheetInput}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={C.placeholder}
          autoCapitalize="words"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSaveName}
        />
        <TouchableOpacity
          style={[styles.sheetSaveBtn, !nameDirty && styles.sheetSaveBtnDisabled]}
          onPress={handleSaveName}
          disabled={saving || !nameDirty}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sheetSaveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </BottomModal>

      {/* ── Username edit sheet ── */}
      <BottomModal
        visible={usernameSheetVisible}
        onClose={() => setUsernameSheetVisible(false)}
      >
        <Text style={styles.sheetTitle}>Username</Text>
        <TextInput
          style={styles.sheetInput}
          value={usernameInput}
          onChangeText={v => setUsernameInput(v.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
          placeholder="e.g. john_doe"
          placeholderTextColor={C.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSaveUsername}
        />
        <TouchableOpacity
          style={[styles.sheetSaveBtn, !usernameDirty && styles.sheetSaveBtnDisabled]}
          onPress={handleSaveUsername}
          disabled={savingUsername || !usernameDirty}
          activeOpacity={0.85}
        >
          {savingUsername
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sheetSaveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </BottomModal>

      {/* ── Theme picker sheet ── */}
      <BottomModal
        visible={themeSheetVisible}
        onClose={() => setThemeSheetVisible(false)}
      >
        <Text style={styles.sheetTitle}>Appearance</Text>
        {(Object.keys(THEME_META) as ThemeKey[]).map((key, i, arr) => {
          const meta = THEME_META[key];
          const theme = THEMES[key];
          const active = themeKey === key;
          const isLast = i === arr.length - 1;
          return (
            <React.Fragment key={key}>
              <TouchableOpacity
                style={styles.themeRow}
                onPress={() => { setTheme(key); setThemeSheetVisible(false); }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={theme.bgGradient}
                  style={styles.themeSwatch}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.themeEmoji}>{meta.emoji}</Text>
                <Text style={[styles.themeLabel, active && { color: C.accent, fontWeight: '700' }]}>
                  {meta.label}
                </Text>
                {active && <Ionicons name="checkmark" size={20} color={C.accent} />}
              </TouchableOpacity>
              {!isLast && <View style={styles.pickerSep} />}
            </React.Fragment>
          );
        })}
      </BottomModal>

      {/* ── Change password sheet ── */}
      <BottomModal
        visible={pwSheetVisible}
        onClose={() => setPwSheetVisible(false)}
      >
        <Text style={styles.sheetTitle}>Change Password</Text>

        <Text style={styles.pwFieldLabel}>Current Password</Text>
        <View style={styles.pwInputRow}>
          <TextInput
            style={styles.pwInput}
            value={currentPw}
            onChangeText={setCurrentPw}
            placeholder="Enter current password"
            placeholderTextColor={C.placeholder}
            secureTextEntry={!showCurrentPw}
            autoFocus
          />
          <TouchableOpacity onPress={() => setShowCurrentPw(v => !v)} style={styles.pwEye}>
            <Ionicons name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.pwFieldLabel}>New Password</Text>
        <View style={styles.pwInputRow}>
          <TextInput
            style={styles.pwInput}
            value={newPw}
            onChangeText={setNewPw}
            placeholder="At least 8 characters"
            placeholderTextColor={C.placeholder}
            secureTextEntry={!showNewPw}
          />
          <TouchableOpacity onPress={() => setShowNewPw(v => !v)} style={styles.pwEye}>
            <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.pwFieldLabel}>Confirm New Password</Text>
        <View style={[styles.pwInputRow, { marginBottom: 20 }]}>
          <TextInput
            style={styles.pwInput}
            value={confirmPw}
            onChangeText={setConfirmPw}
            placeholder="Repeat new password"
            placeholderTextColor={C.placeholder}
            secureTextEntry={!showConfirmPw}
            returnKeyType="done"
            onSubmitEditing={handleChangePassword}
          />
          <TouchableOpacity onPress={() => setShowConfirmPw(v => !v)} style={styles.pwEye}>
            <Ionicons name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.sheetSaveBtn, !pwReady && styles.sheetSaveBtnDisabled]}
          onPress={handleChangePassword}
          disabled={savingPw || !pwReady}
          activeOpacity={0.85}
        >
          {savingPw
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sheetSaveBtnText}>Update Password</Text>
          }
        </TouchableOpacity>
      </BottomModal>

      {/* ── Currency picker sheet ── */}
      <BottomModal
        visible={currencyPickerVisible}
        onClose={() => setCurrencyPickerVisible(false)}
      >
        <Text style={styles.sheetTitle}>Preferred Currency</Text>
        {CURRENCIES.map((c, i) => {
          const active = preferredCurrency === c;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.currencyRow, i > 0 && styles.pickerSep]}
              onPress={() => { setCurrencyPickerVisible(false); handleSaveCurrency(c); }}
              activeOpacity={0.7}
            >
              <View style={[styles.currencySymbolBadge, { backgroundColor: C.accentSoft }]}>
                <Text style={[styles.currencySymbolText, { color: C.accent }]}>{symbolOf(c).trim()}</Text>
              </View>
              <View style={styles.currencyInfo}>
                <Text style={[styles.currencyCode, active && { color: C.accent }]}>{c}</Text>
                <Text style={styles.currencyName}>{CURRENCY_NAMES[c] ?? ''}</Text>
              </View>
              {active && <Ionicons name="checkmark" size={18} color={C.accent} />}
            </TouchableOpacity>
          );
        })}
      </BottomModal>
    </>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { paddingBottom: TAB_PAD },

    pageTitle: {
      fontSize: 34,
      fontWeight: '700',
      color: C.text,
      letterSpacing: -0.5,
      marginHorizontal: 20,
      marginBottom: 20,
    },

    // ── User card (iOS 26 account row style) ──
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: C.bgElevated,
      borderRadius: 20,
      // @ts-ignore — iOS-only continuous squircle curve
      borderCurve: 'continuous',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 14,
    },
    avatarBtn: { position: 'relative' },
    cameraOverlay: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: C.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: C.bgElevated,
    },
    userInfo: { flex: 1 },
    userName: { fontSize: 17, fontWeight: '600', color: C.text, letterSpacing: -0.2 },
    userHandle: { fontSize: 13, color: C.accent, fontWeight: '500', marginTop: 1 },
    userEmail: { fontSize: 13, color: C.textSecondary, marginTop: 1 },

    // ── Credits card (lives inside a card group) ──
    creditsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: C.bgElevated,
      borderRadius: 20,
      // @ts-ignore
      borderCurve: 'continuous',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    creditsLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
    creditsLabel: { fontSize: 17, color: C.text, fontWeight: '400' },
    creditsSub: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
    creditsBalance: { fontSize: 15, color: '#5E5CE6', fontWeight: '600', marginRight: 2 },

    // ── Section header — iOS 26: sentence case, subtle gray ──
    sectionHeader: {
      fontSize: 13,
      fontWeight: '400',
      color: C.textSecondary,
      marginLeft: 20,
      marginBottom: 6,
      marginTop: 22,
    },

    // ── Settings card (inset grouped) ──
    card: {
      marginHorizontal: 16,
      marginBottom: 0,
      backgroundColor: C.bgElevated,
      borderRadius: 20,
      // @ts-ignore
      borderCurve: 'continuous',
      overflow: 'hidden',
    },

    // ── Row ──
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      height: 54,
      gap: 14,
    },
    iconBadge: {
      width: 30,
      height: 30,
      borderRadius: 7,
      // @ts-ignore
      borderCurve: 'continuous',
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeCurrencyText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
    rowLabel: {
      flex: 1,
      fontSize: 17,
      color: C.text,
      fontWeight: '400',
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    rowValue: {
      fontSize: 17,
      color: C.textSecondary,
      fontWeight: '400',
    },
    rowSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.separator,
      marginLeft: 60,
    },

    // ── Bottom sheet shared ──
    sheetTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    sheetInput: {
      backgroundColor: C.inputFill,
      borderRadius: 14,
      padding: 14,
      fontSize: 16,
      color: C.text,
      marginBottom: 14,
    },
    sheetSaveBtn: {
      backgroundColor: C.accent,
      borderRadius: 14,
      padding: 15,
      alignItems: 'center',
    },
    sheetSaveBtnDisabled: { backgroundColor: C.inputFillStrong },
    sheetSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    pickerSep: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.separator,
    },

    // ── Password sheet ──
    pwFieldLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: C.textSecondary,
      marginBottom: 6,
      marginTop: 4,
    },
    pwInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.inputFill,
      borderRadius: 14,
      marginBottom: 14,
    },
    pwInput: {
      flex: 1,
      padding: 14,
      fontSize: 16,
      color: C.text,
    },
    pwEye: {
      paddingHorizontal: 14,
    },

    // ── Theme sheet rows ──
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      gap: 14,
    },
    themeSwatch: {
      width: 36,
      height: 36,
      borderRadius: 9,
      // @ts-ignore
      borderCurve: 'continuous',
    },
    themeEmoji: { fontSize: 18 },
    themeLabel: {
      flex: 1,
      fontSize: 17,
      color: C.text,
    },

    // ── Currency sheet rows ──
    currencyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      gap: 14,
    },
    currencySymbolBadge: {
      width: 38,
      height: 38,
      borderRadius: 9,
      // @ts-ignore
      borderCurve: 'continuous',
      justifyContent: 'center',
      alignItems: 'center',
    },
    currencySymbolText: {
      fontSize: 15,
      fontWeight: '700',
    },
    currencyInfo: { flex: 1 },
    currencyCode: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
    },
    currencyName: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 1,
    },
  });
}
