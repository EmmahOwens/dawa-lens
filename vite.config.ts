import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    watch: {
      // Exclude the Rust build artifacts directory — it has tens of thousands of
      // files and exhausts the system's inotify watcher limit (ENOSPC).
      ignored: ["**/rust/target/**", "**/target/**"],
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@capacitor') || id.includes('@capgo')) {
              return 'capacitor-core';
            }
            if (id.includes('firebase')) {
              return 'firebase-bundle';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('@radix-ui')) {
              return 'ui-kit';
            }
            if (id.includes('maplibre-gl')) {
              return 'maplibre';
            }
            if (id.includes('three')) {
              return 'three-bundle';
            }
            if (id.includes('tesseract.js')) {
              return 'tesseract-bundle';
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-bundle';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts-bundle';
            }
            if (id.includes('framer-motion')) {
              return 'motion-bundle';
            }
            if (id.includes('@rive-app') || id.includes('@lottiefiles')) {
              return 'animation-bundle';
            }
            return 'vendor';
          }
        }
      }
    }
  }
}));
