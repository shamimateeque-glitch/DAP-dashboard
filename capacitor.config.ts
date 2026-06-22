import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'inc.ventura.dap.fieldteam',
  appName: 'DAP Field Team',
  // Vite build output — produced by `npm run build`, synced into the native shells.
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0b1220',
      showSpinner: false,
    },
    StatusBar: {
      // Don't draw the webview under the status bar — keeps the top safe-area clear
      // so we don't need a top inset on the header.
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0b1220',
    },
  },
};

export default config;
