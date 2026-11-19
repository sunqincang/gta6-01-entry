// Audio — tiny WebAudio sound effects, all synthesized. No files.
// AudioContext is created lazily on the first user gesture (browser autoplay policy).

let audioCtx = null;

export function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    audioCtx = null;
  }
}

function beep(freq, duration, type = 'sine', volume = 0.15, when = 0, slideTo = null) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Package pickup: rising two-tone chime. */
export function playPickup() {
  beep(520, 0.12, 'sine', 0.15);
  beep(780, 0.15, 'sine', 0.15, 0.1);
}

/** Delivery complete: three-note fanfare. */
export function playDeliver() {
  beep(523, 0.12, 'triangle', 0.16);
  beep(659, 0.12, 'triangle', 0.16, 0.11);
  beep(784, 0.25, 'triangle', 0.18, 0.22);
}

/** Busted: descending trombone-ish buzz. */
export function playBusted() {
  beep(300, 0.5, 'sawtooth', 0.12, 0, 120);
  beep(150, 0.7, 'square', 0.08, 0.1, 60);
}

/** Menu/button blip. */
export function playButton() {
  beep(600, 0.07, 'square', 0.08);
}

/** Wanted level rose: alert tone. */
export function playWantedUp() {
  beep(880, 0.1, 'square', 0.1);
  beep(880, 0.1, 'square', 0.1, 0.15);
}

/** Mission timer running low. */
export function playTick() {
  beep(1000, 0.05, 'square', 0.05);
}
