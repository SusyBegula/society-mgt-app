import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  DetailRow,
  Button,
  Loading,
  ErrorState,
  Empty,
} from "../../src/components/ui";
import { usePages } from "../../src/lib/api";
import { date, time } from "../../src/lib/format";
import type { StaffVisit } from "../../src/types/api";
export default function StaffHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = usePages<StaffVisit>(`/staff/${id}/visits`);
  return (
    <Screen>
      <Header title="Entry & exit history" />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error} retry={query.refetch} />
      {query.data?.pages
        .flatMap((p) => p.items)
        .map((visit) => (
          <Card key={visit.id}>
            <Txt weight="bold">{date(visit.entry_at)}</Txt>
            <DetailRow label="Entry" value={time(visit.entry_at)} />
            <DetailRow
              label="Exit"
              value={visit.exit_at ? time(visit.exit_at) : "Still inside"}
            />
          </Card>
        ))}
      {query.data?.pages[0].total === 0 && <Empty title="No visits recorded" />}
      {query.hasNextPage && (
        <Button
          title="Load more"
          secondary
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </Screen>
  );
}
