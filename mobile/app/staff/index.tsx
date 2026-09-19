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
  Loading,
  ErrorState,
  Empty,
} from "../../src/components/ui";
import { useApi } from "../../src/lib/api";
import { date, time } from "../../src/lib/format";
import type { Staff } from "../../src/types/api";
export default function DomesticHelp() {
  const query = useApi<Staff[]>("/staff");
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header
        title="Domestic help"
        subtitle="People who keep your home running."
      />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error} retry={query.refetch} />
      {query.data?.map((staff) => (
        <Card key={staff.id} onPress={() => router.push(`/staff/${staff.id}`)}>
          <Row>
            <Avatar name={staff.name} size={55} />
            <View style={{ flex: 1 }}>
              <Txt weight="bold" style={{ fontSize: 18 }}>
                {staff.name}
              </Txt>
              <Txt muted>{staff.kind}</Txt>
            </View>
            <Badge status={staff.status} />
          </Row>
          {staff.last_visit && (
            <>
              <Txt muted style={{ fontSize: 12 }}>
                Last entry · {date(staff.last_visit.entry_at)}{" "}
                {time(staff.last_visit.entry_at)}
              </Txt>
              <Txt muted style={{ fontSize: 12 }}>
                Last exit ·{" "}
                {staff.last_visit.exit_at
                  ? `${date(staff.last_visit.exit_at)} ${time(staff.last_visit.exit_at)}`
                  : "Still inside"}
              </Txt>
            </>
          )}
          <Txt weight="semibold" style={{ fontSize: 12 }}>
            View entry history →
          </Txt>
        </Card>
      ))}
      {query.data?.length === 0 && (
        <Empty
          title="No domestic help linked"
          description="Contact your society office to link domestic help to your flat."
          icon="person-outline"
        />
      )}
    </Screen>
  );
}
