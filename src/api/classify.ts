import { API_BASE_URL, MOCK_MODE } from '../config/env';
import { ClassifyResponse } from '../types/api';

const CLASSIFY_URL = `${API_BASE_URL.replace(/\/+$/, '')}/classify`;

/**
 * Confirmed contract:
 *   POST /classify
 *   Body (JSON): { userId, audioBase64, audioFormat: "wav" }
 *   Response: { classification: "SCREAM" | "CODEWORD" | "NORMAL", confidence }
 */
export async function classifyAudioChunkCloud(
  audioBase64: string,
  userId: string,
): Promise<ClassifyResponse> {
  if (MOCK_MODE) {
    console.log('[MOCK API] POST /classify', { userId, audioFormat: 'wav', bytes: audioBase64.length });
    return { classification: 'NORMAL', confidence: 0 };
  }

  const res = await fetch(CLASSIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, audioBase64, audioFormat: 'wav' }),
  });

  if (!res.ok) {
    throw new Error(`POST /classify failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
