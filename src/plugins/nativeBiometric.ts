/**
 * NativeBiometric — Capacitor plugin for biometric authentication.
 *
 * Android: BiometricPrompt (fingerprint, face unlock, device credential fallback)
 * iOS:     LocalAuthentication (Face ID, Touch ID, passcode fallback)
 *
 * Both platforms resolve — never reject — so the caller can decide whether
 * to fail-open or fail-closed based on `success` and `error`.
 */
import { registerPlugin } from '@capacitor/core';

export interface NativeBiometricPlugin {
  isAvailable(): Promise<{ available: boolean; biometryType?: 'face' | 'fingerprint' | 'opticid' | 'none' }>;
  authenticate(options: { reason: string; fallbackTitle?: string }): Promise<{ success: boolean; error?: string }>;
}

const NativeBiometric = registerPlugin<NativeBiometricPlugin>('NativeBiometric');
export { NativeBiometric };
