// Programmatically initialize the Bubblewrap TWA project from the local
// manifest, with all settings deterministically pre-filled.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const require = createRequire(import.meta.url);
const CORE = "/home/runner/workspace/.config/npm/node_global/lib/node_modules/@bubblewrap/cli/node_modules/@bubblewrap/core/dist/lib";
const { TwaManifest } = require(`${CORE}/TwaManifest.js`);
const { TwaGenerator } = require(`${CORE}/TwaGenerator.js`);
const { ConsoleLog } = require(`${CORE}/Log.js`);
const Color = require("/home/runner/workspace/.config/npm/node_global/lib/node_modules/@bubblewrap/cli/node_modules/color");
const c = (hex) => Color(hex);

const log = new ConsoleLog("init-twa");

const MANIFEST_URL = "http://localhost:22926/manifest.json";
const PRODUCTION_HOST = "contract-ai--Contractaiscan.replit.app";
const PRODUCTION_BASE = `https://${PRODUCTION_HOST}`;
const TWA_DIR = path.dirname(fileURLToPath(import.meta.url));

const res = await fetch(MANIFEST_URL);
if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
const webManifest = await res.json();
log.info("Loaded web manifest:", webManifest.name);

const twaManifest = TwaManifest.fromWebManifestJson(
  new URL(MANIFEST_URL),
  webManifest
);

twaManifest.host = PRODUCTION_HOST;
twaManifest.startUrl = "/";
// Use localhost during generation (the production deploy is stale and returns
// HTML for /manifest.json). We rewrite this to the production URL after
// generation succeeds, so the on-device TWA always points at the live site.
twaManifest.webManifestUrl = new URL(MANIFEST_URL);
// Icons are physically embedded in the APK during generation, so use the
// local Vite server which serves them right now. The production URL is
// stale until redeploy and would 404/return HTML.
twaManifest.iconUrl = "http://localhost:22926/icon-512.png";
twaManifest.maskableIconUrl = "http://localhost:22926/icon-512.png";

twaManifest.packageId = "com.contractaiscan.app";
twaManifest.name = "ContractAI";
twaManifest.launcherName = "ContractAI";
twaManifest.appVersionName = "1.0.0";
twaManifest.appVersionCode = 1;

twaManifest.themeColor = c("#6200ee");
twaManifest.themeColorDark = c("#6200ee");
twaManifest.navigationColor = c("#6200ee");
twaManifest.navigationColorDark = c("#6200ee");
twaManifest.navigationDividerColor = c("#6200ee");
twaManifest.navigationDividerColorDark = c("#6200ee");
twaManifest.backgroundColor = c("#ffffff");

twaManifest.display = "standalone";
twaManifest.orientation = "portrait";
twaManifest.fallbackType = "customtabs";
twaManifest.enableNotifications = false;
twaManifest.isChromeOSOnly = false;
twaManifest.isMetaQuest = false;

twaManifest.signingKey = {
  path: path.join(TWA_DIR, "android.keystore"),
  alias: "contractai",
};

const errors = await twaManifest.validate();
if (errors && errors.length) {
  log.warn("twa-manifest validation issues:", errors);
}

const manifestPath = path.join(TWA_DIR, "twa-manifest.json");
await twaManifest.saveToFile(manifestPath);
log.info("Wrote", manifestPath);

const gen = new TwaGenerator();
await gen.createTwaProject(TWA_DIR, twaManifest, log);
log.info("Generated Android TWA project skeleton in", TWA_DIR);

// Rewrite twa-manifest.json to point at the production URLs.
const finalJson = JSON.parse(await fs.readFile(manifestPath, "utf8"));
finalJson.webManifestUrl = `${PRODUCTION_BASE}/manifest.json`;
finalJson.iconUrl = `${PRODUCTION_BASE}/icon-512.png`;
finalJson.maskableIconUrl = `${PRODUCTION_BASE}/icon-512.png`;
await fs.writeFile(manifestPath, JSON.stringify(finalJson, null, 2));
log.info("Rewrote twa-manifest.json URLs to production host");
