// Synthesizes a two-tone siren wail directly in the browser so the
// dashboard never depends on an external audio asset. start/stop are
// idempotent — calling start() while already running, or stop() while
// already stopped, is a no-op.

let audioCtx = null;
let oscillator = null;
let gainNode = null;
let sweepInterval = null;

const MIN_HZ = 650;
const MAX_HZ = 1100;
const STEP_HZ = 40;
const STEP_MS = 40;

export function startSiren() {
  if (audioCtx) return;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return; // unsupported browser — fail silently, visuals still work

  audioCtx = new Ctx();
  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = MIN_HZ;
  gainNode.gain.value = 0.08; // audible without being jarring on a shared desk

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();

  let rising = true;
  sweepInterval = setInterval(() => {
    const current = oscillator.frequency.value;
    const next = rising ? current + STEP_HZ : current - STEP_HZ;
    oscillator.frequency.setValueAtTime(next, audioCtx.currentTime);
    if (next >= MAX_HZ) rising = false;
    if (next <= MIN_HZ) rising = true;
  }, STEP_MS);
}

export function stopSiren() {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
    oscillator = null;
  }
  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}
