import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import {
  Screen,
  Header,
  Card,
  Txt,
  Icon,
  ListItem,
  Confirm,
  ErrorState,
  type IconName,
} from "../src/components/ui";
import { useApi, useAction, send } from "../src/lib/api";
import { colors as c } from "../src/theme";
import type { Contact } from "../src/types/api";
const types: [string, IconName][] = [
  ["Medical", "medical-outline"],
  ["Security", "shield-checkmark-outline"],
  ["Fire", "flame-outline"],
  ["Other", "alert-circle-outline"],
];
export default function Emergency() {
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const query = useApi<Contact[]>("/directory");
  const alerts = useApi<any[]>("/emergency",5000);
  const call = useAction(async (number: string) => {
    await Linking.openURL(`tel:${number}`);
  });
  const alert = useAction(async () => {
    const result = await send<{ message: string }>("/emergency", "POST", {
      kind: selected,
      confirmed: true,
    });
    setMessage(result.message);
    setSelected(null);
  });
  return (
    <Screen>
      <Header title="Emergency assistance" />
      <Txt muted>
        For immediate help, call the appropriate emergency service below.
      </Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {types.map(([type, icon]) => (
          <Pressable
            key={type}
            accessibilityRole="button"
            onPress={() => setSelected(type)}
            style={{
              width: "47.5%",
              minHeight: 140,
              backgroundColor: c.redBg,
              borderRadius: 21,
              alignItems: "center",
              justifyContent: "center",
              gap: 13,
              padding: 14,
            }}
          >
            <Icon name={icon} size={36} color={c.red} />
            <Txt
              weight="bold"
              style={{ color: c.red, textAlign: "center", fontSize: 15 }}
            >
              {type} emergency
            </Txt>
          </Pressable>
        ))}
      </View>
      <ErrorState error={alert.error || call.error || query.error} />
      {message && (
        <Card>
          <Txt>{message}</Txt>
        </Card>
      )}
      {alerts.data?.map(a=><Card key={a.id}><Txt weight="bold">{a.kind} · {a.status}</Txt><Txt>{a.response_note || "Awaiting society response. Call for immediate assistance."}</Txt></Card>)}
      <Txt weight="bold" style={{ fontSize: 18 }}>
        Quick calls
      </Txt>
      <Card style={{ paddingVertical: 4 }}>
        {query.data
          ?.filter((contact) =>
            ["Security", "Office"].includes(contact.category),
          )
          .map((contact) => (
            <ListItem
              key={contact.id}
              icon="call-outline"
              title={contact.name}
              subtitle={contact.phone}
              onPress={() => call.mutate(contact.phone)}
            />
          ))}
        <ListItem
          icon="medical-outline"
          title="Ambulance"
          subtitle="108"
          onPress={() => call.mutate("108")}
        />
        <ListItem
          icon="shield-outline"
          title="Police / Emergency response"
          subtitle="112"
          onPress={() => call.mutate("112")}
        />
      </Card>
      <Txt muted style={{ fontSize: 11 }}>
        Application alerts are recorded in your society account. They do not
        dispatch emergency services.
      </Txt>
      <Confirm
        visible={!!selected}
        title={`${selected} emergency alert?`}
        message="This records an emergency alert for your flat. Please also call security or emergency services for immediate assistance."
        onCancel={() => setSelected(null)}
        onConfirm={() => alert.mutate()}
        loading={alert.isPending}
        danger
        confirmTitle="Record emergency alert"
      />
    </Screen>
  );
}
