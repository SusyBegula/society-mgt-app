import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Green Heights",
  owner: "begulas-hell",
  slug: "society-resident",
  scheme: "societyresident",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: { bundleIdentifier: "com.society.resident", supportsTablet: true },
  android: { package: "com.society.resident" },
  plugins: [
    "expo-router",
    "expo-dev-client",
    "expo-secure-store",
    "expo-notifications",
    "expo-sharing",
    "expo-web-browser",
    "expo-font",
    [
      "expo-image-picker",
      {
        photosPermission: "Choose a profile image or complaint photo.",
        cameraPermission: "Take a complaint photo.",
        microphonePermission: false,
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: process.env.EAS_BUILD_PROFILE !== "production",
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
        "d9c2419c-8b4d-4c8f-8cee-3ce0c904e1fc",
    },
    apiUrl:
      process.env.EXPO_PUBLIC_API_URL ||
      "https://society-mgt-app.onrender.com",
  },
};
export default config;
