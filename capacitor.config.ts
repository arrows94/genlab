import type { CapacitorConfig } from '@capacitor/cli';

/** Android/iOS app shell. Web assets come from `npm run build` (dist/). */
const config: CapacitorConfig = {
  appId: 'io.github.arrows94.genlab',
  appName: 'Genlab',
  webDir: 'dist',
  backgroundColor: '#071317',
  android: {
    // The game is fully offline; no mixed content or remote debugging in release.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
};

export default config;
