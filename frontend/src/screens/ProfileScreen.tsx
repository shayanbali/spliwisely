import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import api from '../services/api';
import { CURRENCIES, symbolOf } from '../utils/currency';
import { C, S, TAB_PAD } from '../theme';

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [preferredCurrency, setPreferredCurrency] = useState(
    user?.preferred_currency ?? 'USD',
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow access to your photo library to set a profile picture.',
      );
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
      form.append('avatar', {
        uri: asset.uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      } as any);

      const { data } = await api.patch('/auth/me/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      const { data } = await api.patch('/auth/me/', { name: name.trim() });
      setUser(data);
      setSaved(true);
    } catch {
      Alert.alert('Error', 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  }

  const nameDirty = name.trim().length > 0 && name !== user?.name;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Top hero section */}
      <View style={styles.hero}>
        <TouchableOpacity
          onPress={handlePickAvatar}
          disabled={uploadingAvatar}
          activeOpacity={0.85}
        >
          <Avatar
            name={user?.name}
            email={user?.email}
            avatar={user?.avatar}
            size={88}
            fontSize={36}
          />
          <View style={styles.cameraOverlay}>
            {uploadingAvatar
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.cameraIcon}>📷</Text>
            }
          </View>
        </TouchableOpacity>
        <Text style={styles.heroName}>{user?.name || user?.email}</Text>
        <Text style={styles.heroEmail}>{user?.email}</Text>
      </View>

      {/* Display name card */}
      <Text style={styles.sectionLabel}>Display Name</Text>
      <View style={[styles.card, S.shadowSm]}>
        <View style={styles.cardInner}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={v => { setName(v); setSaved(false); }}
            placeholder="Your name"
            placeholderTextColor={C.placeholder}
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={[styles.saveBtn, !nameDirty && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || !nameDirty}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : (
                <Text style={styles.saveBtnText}>
                  {saved ? '✓ Saved' : 'Save Changes'}
                </Text>
              )
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Preferred currency card */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabelInline}>Preferred Currency</Text>
        {savingCurrency && <ActivityIndicator size="small" color={C.accent} />}
      </View>
      <View style={[styles.card, S.shadowSm]}>
        <View style={styles.cardInner}>
          <Text style={styles.currencyHint}>
            All balances and totals will be shown in this currency.
          </Text>
          <View style={styles.currencyGrid}>
            {CURRENCIES.map(c => {
              const active = preferredCurrency === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.currencyChip, active && styles.currencyChipActive]}
                  onPress={() => handleSaveCurrency(c)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.currencyChipSym,
                      active && styles.currencyChipTextActive,
                    ]}
                  >
                    {symbolOf(c).trim()}
                  </Text>
                  <Text
                    style={[
                      styles.currencyChipCode,
                      active && styles.currencyChipTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Account card */}
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={[styles.card, S.shadowSm]}>
        <TouchableOpacity
          style={styles.logoutRow}
          onPress={logout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Log out</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: TAB_PAD, paddingTop: 60 },

  hero: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: C.bg,
  },
  cameraIcon: { fontSize: 13 },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    marginTop: 16,
    letterSpacing: -0.3,
  },
  heroEmail: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: 4,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 20,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 20,
    marginTop: 20,
  },
  sectionLabelInline: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 20,
  },

  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: C.bgElevated,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 18,
  },

  input: {
    backgroundColor: C.inputFill,
    borderWidth: 0,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 14,
    color: C.text,
  },
  saveBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: C.inputFillStrong,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  currencyHint: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 14,
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyChip: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.inputFill,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 6,
  },
  currencyChipActive: {
    backgroundColor: C.accent,
  },
  currencyChipSym: { fontSize: 15, fontWeight: '700', color: C.text },
  currencyChipCode: { fontSize: 13, color: C.text, fontWeight: '600' },
  currencyChipTextActive: { color: '#fff' },

  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  logoutText: { fontSize: 17, color: C.negative, fontWeight: '600' },
  chevron: { fontSize: 22, color: C.chevron, fontWeight: '300' },
});
