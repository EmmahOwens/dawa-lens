package com.dawainnovation.lens;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

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
