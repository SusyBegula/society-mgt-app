import { useState } from "react";
import { router } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Badge,
  Button,
  Chips,
  Loading,
  ErrorState,
  Empty,
} from "../../src/components/ui";
import { usePages } from "../../src/lib/api";
import { date } from "../../src/lib/format";
import type { Complaint } from "../../src/types/api";
export default function Complaints() {
  const query = usePages<Complaint>("/complaints");
  const [tab, setTab] = useState("All");
  const rows = query.data?.pages
    .flatMap((p) => p.items)
    .filter(
      (row) =>
        tab === "All" ||
        (tab === "Active"
          ? !["Resolved", "Closed"].includes(row.status)
          : ["Resolved", "Closed"].includes(row.status)),
    );
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header
        title="Complaints"
        subtitle="We're here to help make things right."
        back={false}
      />
      <Button
        title="Raise a complaint"
        icon="add"
        onPress={() => router.push("/complaints/new")}
      />
      <Chips
        options={["All", "Active", "Resolved"]}
        value={tab}
        onChange={setTab}
      />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error} retry={query.refetch} />
      {rows?.map((row) => (
        <Card key={row.id} onPress={() => router.push(`/complaints/${row.id}`)}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt muted style={{ fontSize: 11 }}>
              #{row.id.slice(0, 6).toUpperCase()} · {row.category}
            </Txt>
            <Badge status={row.status} />
          </Row>
          <Txt weight="bold" style={{ fontSize: 17 }}>
            {row.title}
          </Txt>
          <Txt muted numberOfLines={2} style={{ fontSize: 12 }}>
            {row.description}
          </Txt>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt muted style={{ fontSize: 11 }}>
              {date(row.created_at)}
            </Txt>
            <Txt muted style={{ fontSize: 11 }}>
              {row.priority} priority
            </Txt>
          </Row>
        </Card>
      ))}
      {rows?.length === 0 && (
        <Empty
          title="No complaints here"
          description="If something needs attention, let your society know."
          icon="chatbox-outline"
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
    </Screen>
  );
}
