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
import java.net.URI;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Capacitor plugin that downloads an APK from a verified HTTPS URL and prompts the user
 * to install it via the system package installer after cryptographic verification.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final String TAG = "AppUpdater";

    // Fixed HTTPS allow-list for release distribution (GitHub Releases)
    private static final Set<String> ALLOWED_HOSTS = new HashSet<>(Arrays.asList(
            "github.com",
            "api.github.com",
            "objects.githubusercontent.com",
            "raw.githubusercontent.com"
    ));

    // Upper bound cap on APK size to prevent storage denial-of-service (150 MB)
    private static final long MAX_APK_BYTES = 150L * 1024 * 1024;

    private static boolean isAllowedHost(String host) {
        if (host == null) return false;
        String lowerHost = host.toLowerCase(Locale.ROOT);
        return ALLOWED_HOSTS.contains(lowerHost);
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

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
     * Downloads an APK from `url`, verifies its integrity via `sha256` (if provided),
     * enforces HTTPS and approved release hosts, and triggers the installer.
     * Emits `downloadProgress` events with { percent: 0-100 }.
     */
    @PluginMethod()
    public void downloadAndInstall(PluginCall call) {
        String initialUrl = call.getString("url");
        String expectedSha256 = call.getString("sha256");

        if (initialUrl == null || initialUrl.trim().isEmpty()) {
            call.reject("Missing required parameter: url");
            return;
        }

        final String downloadUrlStr = initialUrl.trim();

        // Run on background thread
        new Thread(() -> {
            HttpURLConnection connection = null;
            InputStream inputStream = null;
            FileOutputStream outputStream = null;
            File apkFile = null;

            try {
                String currentUrl = downloadUrlStr;
                int redirects = 0;
                final int MAX_REDIRECTS = 5;

                // Validate initial URL protocol and host
                URI uri = new URI(currentUrl);
                if (!"https".equalsIgnoreCase(uri.getScheme())) {
                    call.reject("Untrusted protocol: Only HTTPS download URLs are permitted.");
                    return;
                }
                if (!isAllowedHost(uri.getHost())) {
                    call.reject("Untrusted host: Download destination is not in the approved release allow-list (" + uri.getHost() + ").");
                    return;
                }

                // Resolve redirects explicitly to ensure every hop remains on HTTPS and allowed hosts
                while (redirects < MAX_REDIRECTS) {
                    URL url = new URL(currentUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream");
                    connection.connect();

                    int responseCode = connection.getResponseCode();
                    if (responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                        responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                        responseCode == 307 || responseCode == 308) {

                        String location = connection.getHeaderField("Location");
                        if (location == null || location.isEmpty()) {
                            call.reject("Redirect without Location header");
                            return;
                        }

                        URI targetUri = uri.resolve(location);
                        if (!"https".equalsIgnoreCase(targetUri.getScheme())) {
                            call.reject("Insecure redirect: Target is not HTTPS.");
                            return;
                        }
                        if (!isAllowedHost(targetUri.getHost())) {
                            call.reject("Untrusted redirect destination: Host not allowed (" + targetUri.getHost() + ").");
                            return;
                        }

                        currentUrl = targetUri.toString();
                        uri = targetUri;
                        connection.disconnect();
                        redirects++;
                    } else if (responseCode == HttpURLConnection.HTTP_OK) {
                        break;
                    } else {
                        call.reject("Download failed with HTTP status " + responseCode);
                        return;
                    }
                }

                if (redirects >= MAX_REDIRECTS) {
                    call.reject("Too many redirects during APK download");
                    return;
                }

                long contentLength = connection.getContentLengthLong();
                if (contentLength > MAX_APK_BYTES) {
                    call.reject("APK exceeds maximum permitted size (" + (MAX_APK_BYTES / (1024 * 1024)) + "MB).");
                    return;
                }

                inputStream = connection.getInputStream();

                // Setup storage inside app-private internal files directory
                File updateDir = new File(getContext().getFilesDir(), "apk_updates");
                if (!updateDir.exists() && !updateDir.mkdirs()) {
                    call.reject("Failed to create update directory.");
                    return;
                }

                // Clean up any stale updates
                File[] oldFiles = updateDir.listFiles();
                if (oldFiles != null) {
                    for (File f : oldFiles) {
                        f.delete();
                    }
                }

                apkFile = new File(updateDir, "update.apk");
                outputStream = new FileOutputStream(apkFile);

                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                byte[] buffer = new byte[8192];
                int bytesRead;
                long totalBytesRead = 0;
                int lastReportedPercent = -1;

                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    totalBytesRead += bytesRead;
                    if (totalBytesRead > MAX_APK_BYTES) {
                        outputStream.close();
                        outputStream = null;
                        apkFile.delete();
                        call.reject("Download terminated: Exceeded maximum allowed size.");
                        return;
                    }

                    outputStream.write(buffer, 0, bytesRead);
                    digest.update(buffer, 0, bytesRead);

                    // Emit progress
                    if (contentLength > 0) {
                        int percent = (int) ((totalBytesRead * 100) / contentLength);
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

                // --- Cryptographic Checksum Verification ---
                if (expectedSha256 != null && !expectedSha256.trim().isEmpty()) {
                    String cleanExpected = expectedSha256.trim().toLowerCase(Locale.ROOT);
                    String computedHash = bytesToHex(digest.digest()).toLowerCase(Locale.ROOT);

                    // Constant-time comparison
                    boolean matches = MessageDigest.isEqual(
                            cleanExpected.getBytes("UTF-8"),
                            computedHash.getBytes("UTF-8")
                    );

                    if (!matches) {
                        apkFile.delete();
                        call.reject("APK verification failed: SHA-256 checksum mismatch. Expected: " + cleanExpected + ", Computed: " + computedHash);
                        return;
                    }
                }

                // --- Trigger system package installer ---
                Uri apkUri;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
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
                if (apkFile != null && apkFile.exists()) {
                    apkFile.delete();
                }
                call.reject("Download/verification failed: " + e.getMessage(), e);
            } finally {
                try { if (inputStream != null) inputStream.close(); } catch (Exception ignored) {}
                try { if (outputStream != null) outputStream.close(); } catch (Exception ignored) {}
                if (connection != null) connection.disconnect();
            }
        }).start();
    }
}
