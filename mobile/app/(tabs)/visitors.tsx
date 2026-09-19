import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Avatar,
  Badge,
  Button,
  Chips,
  Loading,
  ErrorState,
  Empty,
  Confirm,
} from "../../src/components/ui";
import { usePages, useAction, send } from "../../src/lib/api";
import { date, time } from "../../src/lib/format";
import type { Visitor, Invitation } from "../../src/types/api";
export default function Visitors() {
  const [tab, setTab] = useState("Visitors");
  const visitors = usePages<Visitor>("/visitors");
  const invites = usePages<Invitation>("/visitors/invitations/list");
  const query = tab === "Visitors" ? visitors : invites;
  const [decision, setDecision] = useState<{
    visitor: Visitor;
    status: string;
  } | null>(null);
  const action = useAction(async () => {
    await send(`/visitors/${decision!.visitor.id}`, "PATCH", {
      status: decision!.status,
    });
    setDecision(null);
  });
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header
        title="Visitors"
        subtitle="A warm welcome. A safer home."
        back={false}
      />
      <Button
        title="Invite a visitor"
        icon="person-add-outline"
        onPress={() => router.push("/visitors/invite")}
      />
      <Chips
        options={["Visitors", "Invitations"]}
        value={tab}
        onChange={setTab}
      />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error || action.error} retry={query.refetch} />
      {tab === "Visitors"
        ? visitors.data?.pages
            .flatMap((p) => p.items)
            .map((visitor) => (
              <Card key={visitor.id}>
                <Row>
                  <Avatar name={visitor.name} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold" style={{ fontSize: 16 }}>
                      {visitor.name}
                    </Txt>
                    <Txt muted style={{ fontSize: 12 }}>
                      {visitor.kind} · {visitor.gate}
                    </Txt>
                  </View>
                  <Badge status={visitor.status} />
                </Row>
                <Txt muted style={{ fontSize: 12 }}>
                  {visitor.purpose} · {visitor.phone}
                </Txt>
                <Txt muted style={{ fontSize: 11 }}>
                  {date(visitor.arrived_at)} · Arrived{" "}
                  {time(visitor.arrived_at)}
                  {visitor.vehicle_number ? ` · ${visitor.vehicle_number}` : ""}
                </Txt>
                {visitor.entry_at && (
                  <Txt muted style={{ fontSize: 11 }}>
                    Entry {time(visitor.entry_at)}
                    {visitor.exit_at ? ` · Exit ${time(visitor.exit_at)}` : ""}
                  </Txt>
                )}
                {visitor.status === "Waiting" && (
                  <Row>
                    <Button
                      title="Deny"
                      secondary
                      danger
                      style={{ flex: 1 }}
                      onPress={() => setDecision({ visitor, status: "Denied" })}
                    />
                    <Button
                      title="Allow entry"
                      style={{ flex: 1 }}
                      onPress={() =>
                        setDecision({ visitor, status: "Allowed" })
                      }
                    />
                  </Row>
                )}
              </Card>
            ))
        : invites.data?.pages
            .flatMap((p) => p.items)
            .map((invite) => (
              <Card
                key={invite.id}
                onPress={() =>
                  router.push({
                    pathname: "/visitors/invitation",
                    params: { id: invite.id },
                  })
                }
              >
                <Row>
                  <Avatar name={invite.name} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold">{invite.name}</Txt>
                    <Txt muted style={{ fontSize: 12 }}>
                      {date(invite.start_at)} · {time(invite.start_at)}
                    </Txt>
                  </View>
                  <Badge status={invite.status} />
                </Row>
                <Txt muted style={{ fontSize: 12 }}>
                  Entry PIN · {invite.pin}
                </Txt>
              </Card>
            ))}
      {query.data?.pages[0]?.total === 0 && (
        <Empty
          title={
            tab === "Visitors" ? "No visitors today" : "No invitations yet"
          }
          description="Invite someone and make their arrival a little easier."
          icon="people-outline"
        />
      )}
      {query.hasNextPage && (
        <Button
          title="Load more"
          secondary
          loading={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
      <Confirm
        visible={!!decision}
        title={
          decision?.status === "Allowed"
            ? "Allow this visitor?"
            : "Deny this visitor?"
        }
        message={`${decision?.visitor.name ?? ""} is waiting at ${decision?.visitor.gate ?? "the gate"}.`}
        onCancel={() => setDecision(null)}
        onConfirm={() => action.mutate()}
        loading={action.isPending}
        danger={decision?.status === "Denied"}
      />
    </Screen>
  );
}
