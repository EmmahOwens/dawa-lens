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
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
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
            if (id.includes('lucide-react') || id.includes('@radix-ui')) {
              return 'ui-kit';
            }
            return 'vendor';
          }
        }
      }
    }
  }
}));
