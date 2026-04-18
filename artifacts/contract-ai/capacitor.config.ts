import type { CapacitorConfig } from "@capacitor/cli";

// IMPORTANT: Set CAPACITOR_SERVER_URL to your live, stable production URL
// (e.g. "https://contractai.app" or "https://your-app.replit.app").
// Once you ship an APK, the URL is baked into the install — pick a permanent domain.
const SERVER_URL = process.env["CAPACITOR_SERVER_URL"]
  ?? "https://bcd709ae-9793-4fdb-9132-3b2407e3429e-00-2evz1s3yshy01.riker.replit.dev";

const config: CapacitorConfig = {
  appId: "com.contractai.app",
  appName: "ContractAI",
  webDir: "dist",
  server: {
    url: SERVER_URL,
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
