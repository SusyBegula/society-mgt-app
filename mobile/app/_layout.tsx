import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { queryClient } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { Loading, Screen } from "../src/components/ui";
import { colors } from "../src/theme";
import "../src/lib/push";
import { openPushNotification } from "../src/lib/notification-navigation";
export { ErrorBoundary } from "expo-router";

export default function Layout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const { hydrated, tokens, hydrate } = useSession();
  const handledResponse = useRef<string | null>(null);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (!hydrated || !tokens || Platform.OS === "web") return;
    const handle = async (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handledResponse.current === id) return;
      handledResponse.current = id;
      try {
        await openPushNotification(response.notification.request.content.data ?? {});
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        handledResponse.current = null;
        Alert.alert("Unable to open alert", "Check your connection and open Notifications in the relevant society.");
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(
      response => { void handle(response); },
    );
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) void handle(response);
    }).catch(() => {});
    return () => subscription.remove();
  }, [hydrated, tokens]);
  if ((!loaded && !error) || !hydrated)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Protected guard={!tokens}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" />
          <Stack.Screen name="otp" />
        </Stack.Protected>
        <Stack.Protected guard={!!tokens}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="properties" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="community" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="refunds" />
          <Stack.Screen name="parcels" />
          <Stack.Screen name="admin/refunds" />
          <Stack.Screen name="platform" />
          <Stack.Screen name="admin/assets" />
          <Stack.Screen name="admin/privacy" />
          <Stack.Screen name="admin/setup" />
          <Stack.Screen name="admin/resources" />
          <Stack.Screen name="admin/policies" />
          <Stack.Screen name="guard/help" />
          <Stack.Screen name="admin/finance-tools" />
          <Stack.Screen name="guard/emergencies" />
          <Stack.Screen name="bills/[id]" />
          <Stack.Screen name="receipt/[id]" />
          <Stack.Screen name="visitors/invite" />
          <Stack.Screen name="visitors/invitation" />
          <Stack.Screen name="complaints/new" />
          <Stack.Screen name="complaints/[id]" />
          <Stack.Screen name="notices/index" />
          <Stack.Screen name="notices/[id]" />
          <Stack.Screen name="amenities/index" />
          <Stack.Screen name="amenities/[id]" />
          <Stack.Screen name="bookings" />
          <Stack.Screen name="vehicles" />
          <Stack.Screen name="family" />
          <Stack.Screen name="staff/index" />
          <Stack.Screen name="staff/[id]" />
          <Stack.Screen name="documents" />
          <Stack.Screen name="directory" />
          <Stack.Screen name="emergency" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="information" />
          <Stack.Screen name="guard/index" />
          <Stack.Screen name="guard/verify" />
          <Stack.Screen name="guard/walk-in" />
          <Stack.Screen name="guard/parcels" />
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="admin/notices" />
          <Stack.Screen name="admin/complaints" />
          <Stack.Screen name="admin/members" />
          <Stack.Screen name="admin/finance" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
