import { UserProfile } from '../types/api';
import { API_BASE_URL, MOCK_MODE } from './incidents';

const USERS_URL = `${API_BASE_URL.replace(/\/+$/, '')}/users`;

export async function createOrUpdateUser(profile: UserProfile): Promise<{ userId: string }> {
  if (MOCK_MODE) {
    console.log('[MOCK API] POST /users', profile);
    return { userId: `mock-user-${Date.now()}` };
  }

  const res = await fetch(USERS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });

  if (!res.ok) {
    throw new Error(`POST /users failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
