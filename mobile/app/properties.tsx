import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Screen,
  Header,
  Card,
  Row,
  Txt,
  Icon,
  Badge,
  Loading,
  ErrorState,
  Empty,
  Button,
} from "../src/components/ui";
import { useApi } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Property } from "../src/types/api";
export default function Properties() {
  const query = useApi<Property[]>("/properties");
  const client = useQueryClient();
  const mode = useLocalSearchParams<{ switch?: string }>().switch;
  const select = async (property: Property) => {
    await client.cancelQueries();
    client.clear();
    await useSession.getState().setProperty(property);
    router.replace("/");
  };
  useEffect(() => {
    if (query.data?.length === 1 && !mode) void select(query.data[0]);
  }, [query.data, mode]);
  return (
    <Screen>
      <Header
        title="Choose your home"
        subtitle="One account. All your properties."
        back={!!useSession((s) => s.property)}
      />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error} retry={query.refetch} />
      {query.data?.map((property) => (
        <Card key={property.id} onPress={() => void select(property)}>
          <Row>
            <Icon name="business-outline" size={35} />
            <ViewText property={property} />
            <Icon name="arrow-forward" />
          </Row>
          <Badge status={property.role} />
        </Card>
      ))}
      {query.data?.length === 0 && (
        <>
          <Empty
            title="No property linked yet"
            description="Ask your society office or an eligible household member to add your mobile number."
            icon="home-outline"
          />
          <Button
            title="Check again"
            onPress={() => void query.refetch()}
            secondary
          />
        </>
      )}
      <Button
        title="Sign out"
        secondary
        onPress={() => {
          void useSession.getState().clear();
          client.clear();
        }}
      />
    </Screen>
  );
}
function ViewText({ property }: { property: Property }) {
  return (
    <>
      <Txt weight="bold" style={{ flex: 1, fontSize: 17 }}>
        {property.society}
        {"\n"}
        <Txt muted style={{ fontSize: 12 }}>
          {property.tower} · Flat {property.flat}
        </Txt>
      </Txt>
    </>
  );
}
