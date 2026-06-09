import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UpdateState {
  autoUpdate: boolean;
  wifiOnly: boolean;
  ignoredUpdates: string[];
  currentVersion: string;
  latestVersion: string;
  setAutoUpdate: (value: boolean) => void;
  setWifiOnly: (value: boolean) => void;
  ignoreUpdate: (version: string) => void;
  setCurrentVersion: (version: string) => void;
  setLatestVersion: (version: string) => void;
  isUpdateAvailable: () => boolean;
}

export const useUpdateStore = create<UpdateState>()(
  persist(
    (set, get) => ({
      autoUpdate: false,
      wifiOnly: false,
      ignoredUpdates: [],
      currentVersion: '1.0.0', // initial version
      latestVersion: '1.0.0',
      setAutoUpdate: (value) => set({ autoUpdate: value }),
      setWifiOnly: (value) => set({ wifiOnly: value }),
      ignoreUpdate: (version) => set((state) => ({
        ignoredUpdates: [...state.ignoredUpdates, version],
      })),
      setCurrentVersion: (version) => set({ currentVersion: version }),
      setLatestVersion: (version) => set({ latestVersion: version }),
      isUpdateAvailable: () => {
        const { currentVersion, latestVersion } = get();
        const [currentMajor, currentMinor, currentPatch] = currentVersion.split('.').map(Number);
        const [latestMajor, latestMinor, latestPatch] = latestVersion.split('.').map(Number);
        return (
          latestMajor > currentMajor ||
          (latestMajor === currentMajor && latestMinor > currentMinor) ||
          (latestMajor === currentMajor && latestMinor === currentMinor && latestPatch > currentPatch)
        );
      },
    }),
    {
      name: 'update-storage', // name of the item in the storage (must be unique)
    }
  )
);