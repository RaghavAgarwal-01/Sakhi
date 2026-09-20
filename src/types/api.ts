// API contract shared with the backend team.
// Keep this in sync with what your teammate exposes — this is the
// single source of truth for request/response shapes on the mobile side.

export type InferencePreference = 'LOCAL' | 'CLOUD';

export interface EmergencyContact {
  name: string;
  phoneNumber: string;
  relation?: string;
}

export interface UserProfile {
  userId?: string; // absent on create, present on update
  name: string;
  age: number;
  phoneNumber: string;
  address: string;
  photoUrl?: string;
  customCodeword: string;
  inferencePreference: InferencePreference;
  emergencyContacts: EmergencyContact[];
}

export interface LatLng {
  // Matches the deployed backend API contract exactly.
  lat: number;
  lon: number;
  accuracy?: number;
}

export type TriggerType = 'SCREAM_DETECTED' | 'CODEWORD';

export interface CreateIncidentRequest {
  userId: string;
  triggerType: TriggerType;
  currentLocation: LatLng;
  audioSnippetUrl?: string;
}

export interface CreateIncidentResponse {
  incidentId: string;
}

export interface ManualIncidentRequest {
  userId: string;
  currentLocation: LatLng;
}

export type CancellationReason = 'USER_BIOMETRIC_CONFIRMED';

export interface CancelIncidentRequest {
  cancellationReason: CancellationReason;
}

export type IncidentStatus =
  | 'PENDING'
  | 'CANCELLED'
  | 'ESCALATED_MILD'
  | 'ESCALATED_SEVERE'
  | 'RESOLVED';

export interface IncidentStatusResponse {
  status: IncidentStatus;
}

export type AudioClassification = 'SCREAM' | 'CODEWORD' | 'NORMAL';

export interface ClassifyRequest {
  userId: string;
  audioBase64: string;
  audioFormat: 'wav';
}

export interface ClassifyResponse {
  classification: AudioClassification;
  confidence: number; // 0..1
}
