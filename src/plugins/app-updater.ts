import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface DownloadProgressEvent {
  percent: number;
}

export interface AppUpdaterPlugin {
  /**
   * Downloads an APK from the given URL and triggers the system
   * package installer once the download completes.
   */
  downloadAndInstall(options: { url: string }): Promise<void>;

  /**
   * Listen for download progress updates (0–100%).
   */
  addListener(
    eventName: 'downloadProgress',
    listener: (event: DownloadProgressEvent) => void
  ): Promise<PluginListenerHandle>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export default AppUpdater;
