import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "contractai_biometric_enabled";

export function isBiometricLockEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBiometricLockEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type BiometricAvailability = {
  available: boolean;
  reason?: string;
  // 1 = TouchID, 2 = FaceID, 3 = Fingerprint, 4 = Face Auth, 5 = Iris
  biometryType?: number;
};

export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (!Capacitor.isNativePlatform()) {
    return { available: false, reason: "Biometric lock is only available in the mobile app." };
  }
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    const result = await NativeBiometric.isAvailable();
    if (!result.isAvailable) {
      return { available: false, reason: "Your device does not have biometrics set up." };
    }
    return { available: true, biometryType: result.biometryType };
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function verifyBiometric(reason: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true; // browser: no-op
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      reason,
      title: "ContractAI",
      subtitle: "Confirm it's you",
      description: reason,
      useFallback: true,
    });
    return true;
  } catch {
    return false;
  }
}
