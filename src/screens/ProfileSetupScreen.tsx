import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { createOrUpdateUser } from '../api/users';
import { saveSession } from '../native/session';
import { EmergencyContact, InferencePreference } from '../types/api';
import { color, type, space, radius } from '../theme/tokens';

interface ProfileSetupScreenProps {
  onComplete: (
    userId: string,
    codeword: string,
    inferencePreference: InferencePreference,
    emergencyContactPhone: string,
  ) => void;
}

// Not a real user-facing toggle yet — CLOUD is the only implemented path
// (classifyLocal still throws). Hardcoded here as the single place this
// gets decided, rather than guessed independently elsewhere, so there's
// one spot to change if/when LOCAL becomes real and this should become an
// actual switch in the UI.
const CURRENT_INFERENCE_PREFERENCE: InferencePreference = 'CLOUD';

/**
 * Bare-minimum version to unblock everything downstream of a real userId/
 * codeword. One emergency contact only, no photo upload, no validation
 * beyond "non-empty" — revisit before the demo if there's time, but the
 * rest of the app doesn't need more than this to function.
 */
export function ProfileSetupScreen({ onComplete }: ProfileSetupScreenProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [codeword, setCodeword] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canSubmit =
    name.trim() && age.trim() && phoneNumber.trim() && codeword.trim() && contactPhone.trim();

  const handleSubmit = async () => {
    if (!canSubmit || isSaving) return;
    setIsSaving(true);

    const emergencyContacts: EmergencyContact[] = [
      { name: contactName.trim() || 'Emergency contact', phoneNumber: contactPhone.trim() },
    ];

    try {
      const { userId } = await createOrUpdateUser({
        name: name.trim(),
        age: Number(age),
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
        customCodeword: codeword.trim(),
        inferencePreference: CURRENT_INFERENCE_PREFERENCE,
        emergencyContacts,
      });

      await saveSession({
        userId,
        codeword: codeword.trim(),
        inferencePreference: CURRENT_INFERENCE_PREFERENCE,
        emergencyContactPhone: contactPhone.trim(),
      });
      onComplete(userId, codeword.trim(), CURRENT_INFERENCE_PREFERENCE, contactPhone.trim());
    } catch (err) {
      console.warn('[ProfileSetupScreen] failed to save profile', err);
      Alert.alert('Something went wrong', 'Could not save your profile. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Set up Sakhi</Text>

      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
      <Field label="Phone number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
      <Field label="Address" value={address} onChangeText={setAddress} />
      <Field
        label="Codeword (say this to trigger the alarm)"
        value={codeword}
        onChangeText={setCodeword}
        autoCapitalize="none"
      />
      <Field label="Emergency contact name" value={contactName} onChangeText={setContactName} />
      <Field
        label="Emergency contact phone"
        value={contactPhone}
        onChangeText={setContactPhone}
        keyboardType="phone-pad"
      />

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || isSaving}
      >
        <Text style={styles.buttonText}>{isSaving ? 'Saving…' : 'Save and continue'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingTop: space.xxl, backgroundColor: color.canvas },
  title: { ...type.title, color: color.ink, marginBottom: space.lg },
  field: { marginBottom: space.md },
  label: { ...type.label, color: color.ink, opacity: 0.65, marginBottom: space.xs },
  input: {
    borderWidth: 1,
    borderColor: color.mist,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    ...type.body,
    color: color.ink,
    backgroundColor: color.white,
  },
  button: {
    backgroundColor: color.guardian,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
    marginTop: space.sm,
  },
  buttonDisabled: { backgroundColor: color.mist },
  buttonText: { ...type.body, color: color.white, fontWeight: '700' },
});