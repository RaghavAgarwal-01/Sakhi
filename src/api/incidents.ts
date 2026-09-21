import {
  CreateIncidentRequest,
  CreateIncidentResponse,
  ManualIncidentRequest,
  CancelIncidentRequest,
  IncidentStatusResponse,
  LatLng,
} from '../types/api';
import { API_BASE_URL, MOCK_MODE } from '../config/env';

export { API_BASE_URL, MOCK_MODE };

function apiUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function post<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  if (MOCK_MODE) {
    console.log(`[MOCK API] POST ${path}`, body);
    return mockResponseFor(path, body) as TResponse;
  }

  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<TResponse>;
}

async function get<TResponse>(path: string): Promise<TResponse> {
  if (MOCK_MODE) {
    console.log(`[MOCK API] GET ${path}`);
    return { status: 'PENDING' } as unknown as TResponse;
  }

  const res = await fetch(apiUrl(path));
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<TResponse>;
}

// Deterministic-ish fake responses so mock mode is actually usable in dev.
function mockResponseFor(path: string, body: unknown): unknown {
  if (path === '/incidents' || path === '/incidents/manual') {
    return { incidentId: `mock-${Date.now()}` };
  }
  return {};
}

export function createIncident(
  req: CreateIncidentRequest,
): Promise<CreateIncidentResponse> {
  return post<CreateIncidentResponse, CreateIncidentRequest>('/incidents', req);
}

export function createManualIncident(
  req: ManualIncidentRequest,
): Promise<CreateIncidentResponse> {
  return post<CreateIncidentResponse, ManualIncidentRequest>('/incidents/manual', req);
}

export function cancelIncident(
  incidentId: string,
  req: CancelIncidentRequest,
): Promise<void> {
  return post<void, CancelIncidentRequest>(`/incidents/${incidentId}/cancel`, req);
}

export function updateIncidentLocation(
  incidentId: string,
  location: LatLng,
): Promise<void> {
  return post<void, LatLng>(`/incidents/${incidentId}/location`, location);
}

export function getIncidentStatus(incidentId: string): Promise<IncidentStatusResponse> {
  return get<IncidentStatusResponse>(`/incidents/${incidentId}/status`);
}
