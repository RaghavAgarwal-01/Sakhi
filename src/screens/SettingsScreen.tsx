import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StoredSession, saveSession } from '../native/session';
import { color, radius, space, type } from '../theme/tokens';

interface SettingsScreenProps {
  session: StoredSession;
  onSaved(session: StoredSession): void;
  onClose(): void;
}

/** Lets an existing user change the two details required by local safety flows. */
export function SettingsScreen({ session, onSaved, onClose }: SettingsScreenProps) {
  const [codeword, setCodeword] = useState(session.codeword);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(session.emergencyContactPhone);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const nextCodeword = codeword.trim();
    const nextPhone = emergencyContactPhone.trim();
    if (!nextCodeword || !nextPhone || saving) {
      Alert.alert('Missing details', 'Enter both a codeword and an emergency contact number.');
      return;
    }

    setSaving(true);
    try {
      const next = { ...session, codeword: nextCodeword, emergencyContactPhone: nextPhone };
      await saveSession(next);
      onSaved(next);
    } catch (err) {
      console.warn('[SettingsScreen] failed to save settings', err);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile & safety settings</Text>
      <Text style={styles.help}>These details are stored on this device and used for codeword detection and the emergency-call fallback.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Codeword</Text>
        <TextInput style={styles.input} value={codeword} onChangeText={setCodeword} autoCapitalize="none" />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Emergency contact phone</Text>
        <TextInput style={styles.input} value={emergencyContactPhone} onChangeText={setEmergencyContactPhone} keyboardType="phone-pad" />
      </View>

      <Pressable style={styles.saveButton} onPress={() => void save()} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save settings'}</Text>
      </Pressable>
      <Pressable style={styles.closeButton} onPress={onClose} disabled={saving}>
        <Text style={styles.closeText}>Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.lg, backgroundColor: color.canvas },
  title: { ...type.title, color: color.ink, marginTop: space.lg },
  help: { ...type.body, color: color.ink, opacity: 0.7, marginTop: space.sm, marginBottom: space.xl },
  field: { marginBottom: space.md },
  label: { ...type.label, color: color.ink, opacity: 0.7, marginBottom: space.xs },
  input: { ...type.body, color: color.ink, borderWidth: 1, borderColor: color.mist, borderRadius: radius.sm, backgroundColor: color.white, paddingHorizontal: space.md, paddingVertical: space.sm + 2 },
  saveButton: { backgroundColor: color.guardian, borderRadius: radius.pill, paddingVertical: space.md, alignItems: 'center', marginTop: space.md },
  saveText: { ...type.body, color: color.white, fontWeight: '700' },
  closeButton: { alignItems: 'center', paddingVertical: space.md, marginTop: space.sm },
  closeText: { ...type.body, color: color.ink },
});
