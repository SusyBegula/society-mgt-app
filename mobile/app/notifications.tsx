import { router } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Icon,
  Button,
  Loading,
  ErrorState,
  Empty,
  type IconName,
} from "../src/components/ui";
import { usePages, useAction, send } from "../src/lib/api";
import { date, time } from "../src/lib/format";
import { colors as c } from "../src/theme";
import type { Notification } from "../src/types/api";
const icons: Record<string, IconName> = {
  Visitors: "people-outline",
  Payments: "wallet-outline",
  Complaints: "chatbox-outline",
  Notices: "megaphone-outline",
  Amenities: "calendar-outline",
  Emergency: "shield-outline",
};
export default function Notifications() {
  const query = usePages<Notification>("/notifications");
  const readAll = useAction(() => send("/notifications/read-all", "POST"));
  const open = useAction(async (notification: Notification) => {
    await send(`/notifications/${notification.id}/read`, "POST");
    if (
      /^\/(visitors|payments|complaints|notices|bookings|emergency|receipt)(\/|$)/.test(
        notification.route,
      )
    )
      router.push(notification.route as never);
  });
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header title="Notifications" />
      <Button
        title="Mark all as read"
        secondary
        loading={readAll.isPending}
        onPress={() => readAll.mutate()}
      />
      {query.isLoading && <Loading />}
      <ErrorState
        error={query.error || readAll.error || open.error}
        retry={query.refetch}
      />
      {query.data?.pages
        .flatMap((p) => p.items)
        .map((notification) => (
          <Card
            key={notification.id}
            onPress={() => open.mutate(notification)}
            style={{
              backgroundColor: notification.read_at ? c.surface : "#EFF4E8",
            }}
          >
            <Row>
              <Icon
                name={icons[notification.category] ?? "notifications-outline"}
              />
              <Txt weight="bold" style={{ flex: 1 }}>
                {notification.title}
              </Txt>
              {!notification.read_at && (
                <Txt style={{ color: c.primary }}>●</Txt>
              )}
            </Row>
            <Txt muted style={{ fontSize: 12 }}>
              {notification.body}
            </Txt>
            <Txt muted style={{ fontSize: 10 }}>
              {date(notification.created_at)} · {time(notification.created_at)}
            </Txt>
          </Card>
        ))}
      {query.data?.pages[0].total === 0 && (
        <Empty
          title="You're all caught up"
          description="Your community updates will appear here."
          icon="notifications-outline"
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
