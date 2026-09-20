import { InferencePreference } from '../types/api';
import { ClassifyAudioChunk, ClassificationResult } from '../services/audioMonitor';
import { classifyAudioChunkCloud } from '../api/classify';

/**
 * Returns the classifier function to hand to AudioMonitorService, based on
 * the user's stored inferencePreference. LOCAL stays a stub — building
 * CLOUD first since it's the AWS-hosted path and doesn't need an on-device
 * audio-decoding pipeline (m4a/PCM -> a TFLite-ready format) solved first.
 */
export function getClassifier(preference: InferencePreference, userId: string): ClassifyAudioChunk {
  return preference === 'LOCAL'
    ? classifyLocal
    : (audioChunkBase64: string) => classifyCloud(audioChunkBase64, userId);
}

// TODO: on-device path. Needs an audio-decoding step before a TFLite model
// (e.g. YAMNet) can run on it — deliberately deferred, see CLOUD-first decision.
async function classifyLocal(audioChunkBase64: string): Promise<ClassificationResult> {
  throw new Error('classifyLocal not implemented yet');
}

async function classifyCloud(audioChunkBase64: string, userId: string): Promise<ClassificationResult> {
  const response = await classifyAudioChunkCloud(audioChunkBase64, userId);
  return { classification: response.classification, confidence: response.confidence };
}
