/**
 * Simulated authentication service for East African medicine scratch codes.
 * This mimics services like mPedigree Goldkeys or Sproxil Defender.
 */

export interface VerificationResult {
  status: "authentic" | "fake" | "expired" | "unknown";
  message: string;
  drugName?: string;
  manufacturer?: string;
  batchNumber?: string;
  expiryDate?: string;
}

const REGIONAL_REGISTRY: Record<string, VerificationResult> = {
  "1234567890": {
    status: "authentic",
    message: "This medication is genuine and registered with the NDA.",
    drugName: "Coartem",
    manufacturer: "Novartis",
    batchNumber: "BN-X992",
    expiryDate: "2027-12-31"
  },
  "9876543210": {
    status: "fake",
    message: "ALERT: This code has not been issued for any registered medication. Suspected counterfeit.",
  },
  "5555555555": {
    status: "expired",
    message: "This medication is genuine but has EXPIRED. Do not consume.",
    drugName: "Panadol",
    expiryDate: "2023-01-01"
  }
};

export const verifyScratchCode = async (code: string): Promise<VerificationResult> => {
  // Simulate network delay to regional registry
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const result = REGIONAL_REGISTRY[code];
  if (result) return result;

  return {
    status: "unknown",
    message: "Code not found in registry. Please ensure the code is transcribed correctly or report to authorities."
  };
};
