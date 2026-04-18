import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contractai.app",
  appName: "ContractAI",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Hide the native Android splash instantly so the web app's own purple
      // animation is the first thing the user sees — no double-logo flicker.
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#7C3AED",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
