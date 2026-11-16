/**
 * Audio feedback synthesizer for POS Barcode & QR code scanning using Web Audio API.
 * Zero external audio assets required.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a crisp dual-frequency success beep typical of commercial POS barcode scanners.
 */
export function playScanSuccessBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Pleasant two-stage high pitch chime (1760 Hz to 2640 Hz)
    osc.frequency.setValueAtTime(1760, now);
    osc.frequency.setValueAtTime(2640, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // Ignore audio playback errors
  }
}

/**
 * Play a low warning buzz when a barcode or QR code is not recognized.
 */
export function playScanErrorBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(180, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.21);
  } catch {
    // Ignore audio playback errors
  }
}

/**
 * Short chime played when the cash drawer screen "opens the drawer". It only makes a sound: no
 * ESC/POS drawer-kick command is sent to a printer.
 */
export function playDrawerBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (error) {
    console.warn("Gagal memutar bunyi laci kas:", error);
  }
}

/** True once the browser allows audio playback (after a user gesture). */
export function isAudioReady(): boolean {
  return audioCtx !== null && audioCtx.state === "running";
}

/** Must be called from a click/tap: browsers block audio until the user interacts with the page. */
export async function unlockAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    await ctx.resume();
  } catch {
    return false;
  }
  return ctx.state === "running";
}

/** Kitchen bell for a new incoming order: two bright strikes with a ringing decay. */
export function playKitchenBell(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const strike = (at: number) => {
      for (const [freq, level] of [
        [1318.5, 0.22],
        [2637, 0.08],
        [3951, 0.04],
      ] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, at);
        gain.gain.setValueAtTime(level, at);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 1.15);
      }
    };
    const now = ctx.currentTime;
    strike(now);
    strike(now + 0.35);
  } catch {
    // Ignore audio playback errors
  }
}
