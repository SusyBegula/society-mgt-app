import { Screen, Header, Card, Txt, Badge, Button, Loading, ErrorState, Empty } from "../src/components/ui";
import { usePages } from "../src/lib/api";
import { date, time } from "../src/lib/format";

type Parcel = {
  id: string; courier: string; recipient_name: string; tracking_code: string;
  status: string; otp?: string; created_at: string; collected_at: string | null;
};

export default function Parcels() {
  const query = usePages<Parcel>("/parcels", 10000);
  return <Screen refresh={query.refetch} refreshing={query.isRefetching}>
    <Header title="My parcels" subtitle="Deliveries at your society gate" />
    {query.isLoading && <Loading />}
    <ErrorState error={query.error} retry={query.refetch} />
    {query.data?.pages.flatMap(page => page.items).map(parcel => <Card key={parcel.id}>
      <Txt weight="bold">{parcel.courier}{parcel.recipient_name ? ` · ${parcel.recipient_name}` : ""}</Txt>
      <Badge status={parcel.status} />
      <Txt muted>Arrived {date(parcel.created_at)} · {time(parcel.created_at)}</Txt>
      {!!parcel.tracking_code && <Txt>Tracking: {parcel.tracking_code}</Txt>}
      {parcel.otp && <>
        <Txt weight="bold" selectable>Pickup code: {parcel.otp}</Txt>
        <Txt muted>Give this code to the guard when collecting your parcel.</Txt>
      </>}
      {parcel.collected_at && <Txt muted>Collected {date(parcel.collected_at)} · {time(parcel.collected_at)}</Txt>}
    </Card>)}
    {query.data?.pages[0].total === 0 && <Empty title="No parcels yet" description="Packages logged by your gate desk will appear here." icon="cube-outline" />}
    {query.hasNextPage && <Button title="Load more" secondary loading={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} />}
  </Screen>;
}
