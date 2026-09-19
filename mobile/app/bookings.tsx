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
  Loading,
  ErrorState,
  Empty,
  Confirm,
} from "../src/components/ui";
import { usePages, useAction, send } from "../src/lib/api";
import { date, time } from "../src/lib/format";
import type { Booking } from "../src/types/api";
export default function Bookings() {
  const query = usePages<Booking>("/bookings");
  const [selected, setSelected] = useState<Booking | null>(null);
  const action = useAction(async () => {
    await send(`/bookings/${selected!.id}`, "DELETE");
    setSelected(null);
  });
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header title="My bookings" />
      <Button
        title="Book an amenity"
        secondary
        onPress={() => router.push("/amenities")}
      />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error || action.error} retry={query.refetch} />
      {query.data?.pages
        .flatMap((p) => p.items)
        .map((booking) => (
          <Card key={booking.id}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt weight="bold" style={{ fontSize: 17, flex: 1 }}>
                {booking.amenity_name}
              </Txt>
              <Badge
                status={
                  booking.status === "Confirmed" &&
                  new Date(booking.end_at) < new Date()
                    ? "Completed"
                    : booking.status
                }
              />
            </Row>
            <Txt muted>
              {date(booking.start_at)} · {time(booking.start_at)}–
              {time(booking.end_at)}
            </Txt>
            {booking.status === "Confirmed" &&
              new Date(booking.start_at).getTime() -
                booking.cancel_hours * 3600000 >
                Date.now() && (
                <Button
                  title="Cancel booking"
                  secondary
                  danger
                  onPress={() => setSelected(booking)}
                />
              )}
          </Card>
        ))}
      {query.data?.pages[0].total === 0 && (
        <Empty
          title="No upcoming bookings"
          description="Make some time for the things you enjoy."
          icon="calendar-outline"
        />
      )}
      {query.hasNextPage && (
        <Button
          title="Load more"
          secondary
          onPress={() => void query.fetchNextPage()}
        />
      )}
      <Confirm
        visible={!!selected}
        title="Cancel this booking?"
        message="Your slot will become available to other residents."
        danger
        onCancel={() => setSelected(null)}
        onConfirm={() => action.mutate()}
        loading={action.isPending}
      />
    </Screen>
  );
}
