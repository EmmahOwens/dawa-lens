package com.dawainnovation.lens;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Capacitor plugin that downloads an APK from a URL and prompts the user
 * to install it via the system package installer.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final String TAG = "AppUpdater";

    /**
     * Returns the primary ABI (Application Binary Interface) of the device.
     * Useful for selecting the correct APK split during self-updates.
     */
    @PluginMethod()
    public void getDeviceABI(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            ret.put("abi", Build.SUPPORTED_ABIS[0]);
        } else {
            ret.put("abi", Build.CPU_ABI);
        }
        call.resolve(ret);
    }

    /**
     * Downloads an APK from `url` and opens the installer.
     * Emits `downloadProgress` events with { percent: 0-100 }.
     */
    @PluginMethod()
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing required parameter: url");
            return;
        }

        // Run on a background thread to avoid blocking the UI
        new Thread(() -> {
            HttpURLConnection connection = null;
            InputStream inputStream = null;
            FileOutputStream outputStream = null;

            try {
                // --- Follow redirects (GitHub asset URLs redirect) ---
                URL downloadUrl = new URL(url);
                connection = (HttpURLConnection) downloadUrl.openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
                connection.connect();

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    call.reject("Download failed with HTTP " + responseCode);
                    return;
                }

                int contentLength = connection.getContentLength();
                inputStream = connection.getInputStream();

                // --- Write to internal storage ---
                File updateDir = new File(getContext().getFilesDir(), "apk_updates");
                if (!updateDir.exists()) {
                    updateDir.mkdirs();
                }
                // Clean up old APKs
                File[] oldFiles = updateDir.listFiles();
                if (oldFiles != null) {
                    for (File f : oldFiles) {
                        f.delete();
                    }
                }

                File apkFile = new File(updateDir, "update.apk");
                outputStream = new FileOutputStream(apkFile);

                byte[] buffer = new byte[8192];
                int bytesRead;
                long totalBytesRead = 0;
                int lastReportedPercent = -1;

                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                    totalBytesRead += bytesRead;

                    // Emit progress
                    if (contentLength > 0) {
                        int percent = (int) ((totalBytesRead * 100) / contentLength);
                        // Only emit when percent actually changes to reduce overhead
                        if (percent != lastReportedPercent) {
                            lastReportedPercent = percent;
                            JSObject progressData = new JSObject();
                            progressData.put("percent", percent);
                            notifyListeners("downloadProgress", progressData);
                        }
                    }
                }

                outputStream.flush();
                outputStream.close();
                outputStream = null;

                // --- Trigger package installer ---
                Uri apkUri;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    // Use FileProvider for Android 7+
                    apkUri = FileProvider.getUriForFile(
                            getContext(),
                            getContext().getPackageName() + ".fileprovider",
                            apkFile
                    );
                } else {
                    apkUri = Uri.fromFile(apkFile);
                }

                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getContext().startActivity(installIntent);

                call.resolve();

            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage(), e);
            } finally {
                try { if (inputStream != null) inputStream.close(); } catch (Exception ignored) {}
                try { if (outputStream != null) outputStream.close(); } catch (Exception ignored) {}
                if (connection != null) connection.disconnect();
            }
        }).start();
    }
}
