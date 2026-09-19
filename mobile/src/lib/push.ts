import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { send } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export async function registerPush() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId)
    throw new Error(
      "Push notifications will be available after an EAS project is configured. Your in-app notifications already work.",
    );
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "Society updates",
      importance: Notifications.AndroidImportance.HIGH,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error(
      "Notification permission was not granted. You can enable it in your device settings.",
    );
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await send("/notifications/devices", "POST", {
    token,
    platform: Platform.OS,
  });
}
