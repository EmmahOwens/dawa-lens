package com.dawainnovation.lens;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.dawainnovation.lens.NativeOcrPlugin;
import com.dawainnovation.lens.NativeAlarmPlugin;
import com.dawainnovation.lens.NativeCameraPlugin;
import com.dawainnovation.lens.NativeSearchPlugin;
import com.dawainnovation.lens.NativeSqlitePlugin;
import com.dawainnovation.lens.NativeBiometricPlugin;
import com.dawainnovation.lens.NativePdfPlugin;
import com.dawainnovation.lens.NativeLocationPlugin;
import com.dawainnovation.lens.MissedDoseWorker;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(NativeOcrPlugin.class);
        registerPlugin(NativeAlarmPlugin.class);
        registerPlugin(NativeCameraPlugin.class);
        registerPlugin(NativeSearchPlugin.class);
        registerPlugin(NativeSqlitePlugin.class);
        registerPlugin(NativeBiometricPlugin.class);
        registerPlugin(NativePdfPlugin.class);
        registerPlugin(NativeLocationPlugin.class);
        super.onCreate(savedInstanceState);

        // Enqueue the missed-dose background checker (15-minute period).
        // KEEP policy means a running/enqueued instance is not replaced.
        PeriodicWorkRequest missedDoseWork = new PeriodicWorkRequest.Builder(
                MissedDoseWorker.class, 15, TimeUnit.MINUTES)
                .build();
        WorkManager.getInstance(getApplicationContext())
                .enqueueUniquePeriodicWork(
                        "missed_dose_check",
                        ExistingPeriodicWorkPolicy.KEEP,
                        missedDoseWork);

        WebView webView = getBridge().getWebView();

        // Promote the WebView to a hardware-accelerated GPU layer so scrolling,
        // animations, and CSS transforms are composited off the main thread.
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings settings = webView.getSettings();
        // Persist app data across sessions (localStorage, IndexedDB, etc.)
        settings.setDomStorageEnabled(true);
        // Use the browser's normal cache rules (respect Cache-Control headers)
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Hint to the OS to schedule this WebView with higher render priority
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            // Clear the WebView cache on destroy to prevent memory leaks
            // and stale asset issues after app updates. Pattern from lichobile.
            getBridge().getWebView().clearCache(true);
        } catch (Exception e) { /* ignore — WebView may already be destroyed */ }
    }
}
