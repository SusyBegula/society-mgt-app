import { Linking } from "react-native";
import {
  Screen,
  Header,
  Card,
  Txt,
  ListItem,
  Icon,
  Loading,
  ErrorState,
  Empty,
} from "../src/components/ui";
import { useApi, useAction } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Contact } from "../src/types/api";
export default function Directory() {
  const property = useSession(s => s.property);
  const query = useApi<Contact[]>(property?.context_type === "staff" ? "/guard/directory" : "/directory");
  const call = useAction(async (number: string) => {
    await Linking.openURL(`tel:${number}`);
  });
  return (
    <Screen>
      <Header
        title="Society directory"
        subtitle="A helping hand, just a call away."
      />
      <Txt muted style={{ fontSize: 12 }}>
        Society service contacts. Resident contact details are private.
      </Txt>
      {query.isLoading && <Loading />}
      <ErrorState error={query.error || call.error} retry={query.refetch} />
      <Card style={{ paddingVertical: 0 }}>
        {query.data?.map((contact) => (
          <ListItem
            key={contact.id}
            icon={
              contact.category === "Security"
                ? "shield-outline"
                : "call-outline"
            }
            title={contact.name}
            subtitle={`${contact.category} · ${contact.phone}`}
            right={<Icon name="call" size={19} />}
            onPress={() => call.mutate(contact.phone)}
          />
        ))}
      </Card>
      {query.data?.length === 0 && <Empty title="No contacts available" />}
    </Screen>
  );
}
