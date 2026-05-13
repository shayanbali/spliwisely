import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import api from '../services/api';

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar}>
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
        <Text style={styles.avatarHint}>Tap to change photo</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={v => { setName(v); setSaved(false); }}
          placeholder="Your name"
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || name === user?.name) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || !name.trim() || name === user?.name}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{saved ? '✓ Saved' : 'Save Changes'}</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Account</Text>
        <TouchableOpacity style={styles.logoutRow} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { paddingBottom: 40 },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff', marginBottom: 12 },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1aa672',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  cameraIcon: { fontSize: 13 },
  avatarHint: { fontSize: 12, color: '#1aa672', marginTop: 8, fontWeight: '600' },
  email: { fontSize: 14, color: '#999', marginTop: 4 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 14, backgroundColor: '#fafafa' },
  saveBtn: { backgroundColor: '#1aa672', borderRadius: 10, padding: 15, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: '#b2dfdb' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logoutRow: { paddingVertical: 8 },
  logoutText: { fontSize: 16, color: '#e53935', fontWeight: '600' },
});
