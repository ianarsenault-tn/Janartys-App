import { readFileSync, writeFileSync } from "node:fs";
const file = new URL("../ios/App/App/GoogleService-Info.plist", import.meta.url);
let plist;
try { plist = readFileSync(file, "utf8"); }
catch { throw new Error("Add the Firebase iOS GoogleService-Info.plist for com.janartys.app to ios/App/App in Xcode first, with App target membership."); }
if (!/<key>BUNDLE_ID<\/key>\s*<string>com\.janartys\.app<\/string>/.test(plist) || !/<key>PROJECT_ID<\/key>\s*<string>janarty-s<\/string>/.test(plist)) throw new Error("The Firebase plist must belong to janarty-s / com.janartys.app.");
const configPath = new URL("../capacitor.config.json", import.meta.url);
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.includePlugins = [...new Set([...config.includePlugins, "@capacitor-firebase/messaging"])];
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("Messaging enabled. Run npm run cap:sync, then enable Push Notifications in Xcode Signing & Capabilities. Upload your APNs key to Firebase before testing delivery.");
