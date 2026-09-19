import { useState } from "react";
import { Switch, View } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  ListItem,
  Divider,
  Button,
  ErrorState,
  Confirm,
  Section,
} from "../src/components/ui";
import { useApi, useAction, send, queryClient } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { registerPush } from "../src/lib/push";
import { colors as c } from "../src/theme";
import type { Profile } from "../src/types/api";
const categories = [
  "Visitors",
  "Payments",
  "Complaints",
  "Notices",
  "Amenities",
  "Emergency",
];
export default function Settings() {
  const profile = useApi<Profile>("/residents/me");
  const [confirm, setConfirm] = useState(false);
  const preferences = useAction(
    async ({ key, value }: { key: string; value: boolean }) => {
      const current = Object.fromEntries(
        categories.map((k) => [
          k.toLowerCase(),
          profile.data?.preferences[k.toLowerCase()] ?? true,
        ]),
      );
      await send("/residents/me/preferences", "PUT", {
        ...current,
        [key]: value,
        language: "en",
      });
    },
  );
  const push = useAction(registerPush);
  const logout = useAction(async () => {
    const token = useSession.getState().tokens?.refresh_token;
    try {
      await send("/notifications/devices", "DELETE");
      await send("/auth/logout", "POST", { refresh_token: token });
    } finally {
      await useSession.getState().clear();
      queryClient.clear();
      setConfirm(false);
      router.replace("/welcome");
    }
  });
  return (
    <Screen>
      <Header title="Settings" />
      <ErrorState
        error={profile.error || preferences.error || push.error || logout.error}
      />
      <Section title="Notification preferences" />
      <Card>
        {categories.map((category) => (
          <Row key={category} style={{ justifyContent: "space-between" }}>
            <Txt weight="medium">{category}</Txt>
            <Switch
              accessibilityLabel={`${category} notifications`}
              value={
                profile.data?.preferences[category.toLowerCase()] !== false
              }
              disabled={!profile.data || preferences.isPending}
              onValueChange={(value) =>
                preferences.mutate({ key: category.toLowerCase(), value })
              }
              trackColor={{ true: c.primary }}
            />
          </Row>
        ))}
      </Card>
      <Button
        title="Enable push notifications"
        secondary
        icon="notifications-outline"
        loading={push.isPending}
        onPress={() => push.mutate()}
      />
      {push.isSuccess && <Txt>Push notifications enabled.</Txt>}
      <Section title="Account & preferences" />
      <Card style={{ paddingVertical: 4 }}>
        <ListItem
          icon="business-outline"
          title="Switch property"
          onPress={() => router.push("/properties?switch=true")}
        />
        <Divider />
        <ListItem icon="language-outline" title="Language" subtitle="English" />
        <Divider />
        <ListItem
          icon="lock-closed-outline"
          title="Privacy"
          subtitle="Your contact details stay private"
          onPress={() => router.push("/information?type=privacy")}
        />
      </Card>
      <Section title="We're here to help" />
      <Card style={{ paddingVertical: 4 }}>
        <ListItem
          icon="help-circle-outline"
          title="Help & support"
          onPress={() => router.push("/information?type=help")}
        />
        <Divider />
        <ListItem
          icon="document-text-outline"
          title="Terms of use"
          onPress={() => router.push("/information?type=terms")}
        />
        <Divider />
        <ListItem
          icon="shield-outline"
          title="Privacy policy"
          onPress={() => router.push("/information?type=privacy")}
        />
      </Card>
      <Button
        title="Log out"
        danger
        secondary
        onPress={() => setConfirm(true)}
      />
      <Txt muted style={{ textAlign: "center", fontSize: 11 }}>
        neighbourly · Version 1.0.0
      </Txt>
      <Confirm
        visible={confirm}
        title="Log out of your account?"
        message="You can sign in again with your mobile number."
        onCancel={() => setConfirm(false)}
        onConfirm={() => logout.mutate()}
        loading={logout.isPending}
        confirmTitle="Log out"
      />
    </Screen>
  );
}
