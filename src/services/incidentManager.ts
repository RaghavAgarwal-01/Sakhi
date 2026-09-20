/**
 * Glue layer: when the audio monitor detects a scream/codeword, or the
 * codeword spotter hears it via speech recognition, this creates the
 * incident on the backend and holds the active incidentId so the alarm UI
 * and the biometric cancellation flow both know what they're operating on.
 *
 * Also polls GET /incidents/:id/status while ACTIVE — the local 60s alarm
 * cues stop on their own at the timeout, but the incident itself stays open
 * until either the user cancels via biometrics, or the backend reports it
 * resolved (e.g. a mild escalation call confirmed a false alarm). Without
 * this poll, the client would have no way to learn that and the alarm
 * screen would sit frozen indefinitely with location still streaming.
 */

import { createIncident, cancelIncident as apiCancelIncident, getIncidentStatus } from '../api/incidents';
import { attemptAlarmCancellation, BiometricAuthenticator, CancelResult } from './biometricAuth';
import { TriggerType, LatLng, IncidentStatus } from '../types/api';

const STATUS_POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES: IncidentStatus[] = ['RESOLVED', 'CANCELLED'];

export type IncidentManagerState =
  | { status: 'IDLE' }
  | { status: 'ACTIVE'; incidentId: string; triggerType: TriggerType; backendStatus: IncidentStatus; backendReady: boolean }
  | { status: 'CANCELLING'; incidentId: string; triggerType: TriggerType; backendStatus: IncidentStatus; backendReady: boolean };

type Listener = (state: IncidentManagerState) => void;

export class IncidentManager {
  private userId: string;
  private getCurrentLocation: () => Promise<LatLng>;
  private authenticator: BiometricAuthenticator;

  private state: IncidentManagerState = { status: 'IDLE' };
  private listeners = new Set<Listener>();
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    userId: string,
    getCurrentLocation: () => Promise<LatLng>,
    authenticator: BiometricAuthenticator,
  ) {
    this.userId = userId;
    this.getCurrentLocation = getCurrentLocation;
    this.authenticator = authenticator;
  }

  onStateChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(next: IncidentManagerState): void {
    this.state = next;
    this.listeners.forEach((l) => l(next));
  }

  getState(): IncidentManagerState {
    return this.state;
  }

  /** Call this from the audio monitor's onDetected or the codeword spotter's onCodewordSpoken. */
  async triggerAlarm(triggerType: TriggerType, audioSnippetUrl?: string): Promise<void> {
    if (this.state.status !== 'IDLE') {
      // Already mid-incident — ignore re-triggers until this one resolves.
      return;
    }

    // Local safety cues must never wait for GPS or a network round trip.
    // A synthetic id keeps the existing alarm UI functional until the server
    // acknowledges the incident.
    const localIncidentId = `local-${Date.now()}`;
    this.setState({
      status: 'ACTIVE',
      incidentId: localIncidentId,
      triggerType,
      backendStatus: 'PENDING',
      backendReady: false,
    });

    try {
      const currentLocation = await this.getCurrentLocation();
      const { incidentId } = await createIncident({
        userId: this.userId,
        triggerType,
        currentLocation,
        audioSnippetUrl,
      });
      const current = this.getState();
      if (current.status !== 'ACTIVE' || current.incidentId !== localIncidentId) return;
      this.setState({ ...current, incidentId, backendReady: true });
      this.startPolling(incidentId);
    } catch (err) {
      console.warn('[IncidentManager] alarm is active, but incident upload failed', err);
    }
  }

  /** Wire this to the biometric prompt button/gesture in the alarm UI. */
  async attemptCancellation(): Promise<CancelResult> {
    if (this.state.status !== 'ACTIVE') {
      return { success: false, reason: 'API_ERROR' };
    }

    const { incidentId, triggerType, backendStatus, backendReady } = this.state;
    if (!backendReady) {
      this.stopPolling();
      this.setState({ status: 'IDLE' });
      return { success: true };
    }
    this.setState({ status: 'CANCELLING', incidentId, triggerType, backendStatus, backendReady });

    const result = await attemptAlarmCancellation(this.authenticator, () =>
      apiCancelIncident(incidentId, { cancellationReason: 'USER_BIOMETRIC_CONFIRMED' }),
    );

    if (result.success) {
      this.stopPolling();
      this.setState({ status: 'IDLE' });
    } else {
      // Failed auth or API error: stay ACTIVE so the alarm keeps running
      // (or, post-timeout, so the cancel option stays available) and the
      // user can retry.
      this.setState({ status: 'ACTIVE', incidentId, triggerType, backendStatus, backendReady });
    }

    return result;
  }

  private startPolling(incidentId: string): void {
    this.stopPolling();
    this.pollHandle = setInterval(() => {
      void this.pollStatus(incidentId);
    }, STATUS_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private async pollStatus(incidentId: string): Promise<void> {
    // Only meaningful while we're still tracking this exact incident —
    // a cancel or a new incident could have changed state since this tick
    // was scheduled.
    const current = this.state;
    if (current.status === 'IDLE' || current.incidentId !== incidentId) return;

    try {
      const { status } = await getIncidentStatus(incidentId);

      if (TERMINAL_STATUSES.includes(status)) {
        this.stopPolling();
        this.setState({ status: 'IDLE' });
        return;
      }

      // Still open (PENDING / ESCALATED_MILD / ESCALATED_SEVERE) — update
      // the visible status without disturbing ACTIVE vs CANCELLING.
      this.setState({ ...current, backendStatus: status });
    } catch (err) {
      // Network hiccup mid-poll — try again next interval, don't change state.
      console.warn('[IncidentManager] status poll failed', err);
    }
  }
}
