import type { SetupData } from "./types";

export async function loadSetupData(): Promise<SetupData> {
  const response = await fetch("/data/setup.json", { cache: "no-store" });
  if (!response.ok) {
    return { wardBoundary: null, addressIndex: [], generatedAt: null };
  }
  return response.json();
}
