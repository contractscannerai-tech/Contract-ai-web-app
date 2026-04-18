import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.contractai.app",
  appName: "ContractAI",
  webDir: "dist/public",
  android: {
    allowMixedContent: false,
  },
};

export default config;
