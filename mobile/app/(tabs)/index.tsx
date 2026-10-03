import { EnableAlerts } from "../../src/components/office";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Txt,
  Row,
  Avatar,
  IconButton,
  Icon,
  Card,
  Section,
  Badge,
  Loading,
  ErrorState,
  Empty,
  type IconName,
} from "../../src/components/ui";
import { useApi } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import { date, money, time } from "../../src/lib/format";
import { colors as c } from "../../src/theme";
import type { Home, Profile } from "../../src/types/api";

const actions: {
  title: string;
  icon: IconName;
  route: string;
  bg: string;
  color: string;
}[] = [
  {
    title: "Invite visitor",
    icon: "person-add-outline",
    route: "/visitors/invite",
    bg: "#E9F0E0",
    color: c.primary,
  },
  {
    title: "Complaint",
    icon: "chatbubble-ellipses-outline",
    route: "/complaints/new",
    bg: "#F7EBDC",
    color: "#AA7946",
  },
  {
    title: "Pay dues",
    icon: "wallet-outline",
    route: "/payments",
    bg: "#E6EEF3",
    color: "#53798B",
  },
  {
    title: "Amenities",
    icon: "tennisball-outline",
    route: "/amenities",
    bg: "#EEE8F5",
    color: "#8A70A5",
  },
  {
    title: "Notices",
    icon: "megaphone-outline",
    route: "/notices",
    bg: "#F7EDDA",
    color: "#A78A43",
  },
  {
    title: "Emergency",
    icon: "shield-checkmark-outline",
    route: "/emergency",
    bg: "#F7E6E2",
    color: "#B56B61",
  },
];

export default function HomeScreen() {
  const query = useApi<Home>("/home");
  const profile = useApi<Profile>("/residents/me");
  const property = useSession((s) => s.property)!;
  const data = query.data;
  const hour = new Date().getHours();
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Row style={{ justifyContent: "space-between" }}>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/properties", params: { switch: "true" } })
          }
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel="Switch property"
        >
          <Row style={{ gap: 8 }}>
            <Icon name="location-outline" size={17} />
            <Txt weight="bold" style={{ fontSize: 13 }}>
              {property.society}
            </Txt>
            <Icon name="chevron-down" size={14} />
          </Row>
          <Txt muted style={{ fontSize: 11, marginLeft: 25 }}>
            {property.tower} · Flat {property.flat}
          </Txt>
        </Pressable>
        <IconButton
          name="notifications-outline"
          label="Notifications"
          dot={!!data?.unread}
          onPress={() => router.push("/notifications")}
        />
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityLabel="Open profile"
          accessibilityRole="button"
        >
          <Avatar name={profile.data?.name ?? "Resident"} size={44} />
        </Pressable>
      </Row>
      <View style={{ marginTop: 7, gap: 4 }}>
        <Txt muted style={{ fontSize: 13 }}>
          Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"},
        </Txt>
        <Txt weight="extra" style={{ fontSize: 29, lineHeight: 39 }}>
          {profile.data?.name.split(" ")[0] ?? "Neighbour"}{" "}
          <Txt style={{ fontSize: 25 }}>☀</Txt>
        </Txt>
        <Txt muted style={{ fontSize: 12 }}>
          A little less managing. A little more living.
        </Txt>
      </View>
      {query.isLoading && <Loading />}
      <ErrorState error={query.error} retry={query.refetch} />
      {data && (
        <>
          <View
            style={{
              backgroundColor: c.primary,
              borderRadius: 23,
              padding: 22,
              gap: 17,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                width: 150,
                height: 150,
                borderRadius: 100,
                borderWidth: 22,
                borderColor: "#FFFFFF08",
                right: -45,
                top: -30,
              }}
            />
            <Row style={{ justifyContent: "space-between" }}>
              <Row style={{ gap: 8 }}>
                <Icon name="receipt-outline" color={c.lime} size={18} />
                <Txt
                  style={{ color: "#FFFFFFCE", fontSize: 12 }}
                  weight="medium"
                >
                  {data.due > 0 ? "Maintenance due" : "Peace of mind"}
                </Txt>
              </Row>
              <View
                style={{
                  backgroundColor: "#FFFFFF18",
                  paddingHorizontal: 9,
                  borderRadius: 5,
                }}
              >
                <Txt style={{ color: c.lime, fontSize: 9 }} weight="bold">
                  {data.bill?.period.toUpperCase() ?? "ALL PAID"}
                </Txt>
              </View>
            </Row>
            <Row
              style={{
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <View style={{ gap: 6 }}>
                <Txt
                  weight="extra"
                  style={{
                    fontSize: data.due ? 37 : 26,
                    lineHeight: 44,
                    color: "#fff",
                  }}
                >
                  {data.due ? money(data.due) : "All dues cleared"}
                </Txt>
                <Txt style={{ color: "#C7D7CE", fontSize: 11 }}>
                  {data.bill
                    ? `Next due ${date(data.bill.due_date, { day: "numeric", month: "long" })}`
                    : "You’re all caught up. Enjoy your day."}
                </Txt>
              </View>
              {data.bill && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/bills/${data.bill!.id}`)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 11,
                    backgroundColor: c.lime,
                  }}
                >
                  <Txt weight="bold" style={{ color: c.dark, fontSize: 12 }}>
                    Pay now ↗
                  </Txt>
                </Pressable>
              )}
            </Row>
          </View>
          <Section title="Your everyday, simplified" />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              rowGap: 20,
            }}
          >
            {actions.map((action) => (
              <Pressable
                key={action.title}
                onPress={() => router.push(action.route as never)}
                style={{ width: "31%", alignItems: "center", gap: 8 }}
                accessibilityRole="button"
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    backgroundColor: action.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={action.icon} color={action.color} size={25} />
                </View>
                <Txt weight="semibold" style={{ fontSize: 11 }}>
                  {action.title}
                </Txt>
              </Pressable>
            ))}
          </View>
          <Section title="Around your home" />
          <Row style={{ alignItems: "stretch" }}>
            <Card
              style={{ flex: 1, padding: 16 }}
              onPress={() => router.push("/visitors")}
            >
              <Icon name="people-outline" />
              <Txt weight="extra" style={{ fontSize: 27, lineHeight: 33 }}>
                {data.visitors.length.toString().padStart(2, "0")}
              </Txt>
              <Txt muted style={{ fontSize: 11 }}>
                Visitors today
              </Txt>
            </Card>
            <Card
              style={{ flex: 1, padding: 16 }}
              onPress={() => router.push("/complaints")}
            >
              <Icon name="chatbox-outline" color="#B38B55" />
              <Txt weight="extra" style={{ fontSize: 27, lineHeight: 33 }}>
                {data.active_complaints.toString().padStart(2, "0")}
              </Txt>
              <Txt muted style={{ fontSize: 11 }}>
                Active complaints
              </Txt>
            </Card>
          </Row>
          <Section
            title="Community board"
            action="View all"
            onPress={() => router.push("/notices")}
          />
          {data.notice ? (
            <Card onPress={() => router.push(`/notices/${data.notice!.id}`)}>
              <Row style={{ justifyContent: "space-between" }}>
                <Badge status={data.notice.category} />
                <Txt muted style={{ fontSize: 10 }}>
                  {date(data.notice.published_at, {
                    day: "numeric",
                    month: "short",
                  })}
                </Txt>
              </Row>
              <Txt weight="bold" style={{ fontSize: 17, lineHeight: 25 }}>
                {data.notice.title}
              </Txt>
              <Txt muted numberOfLines={2} style={{ fontSize: 12 }}>
                {data.notice.content}
              </Txt>
              <Row style={{ gap: 6 }}>
                <Txt weight="bold" style={{ color: c.primary, fontSize: 11 }}>
                  Read notice
                </Txt>
                <Icon name="arrow-forward" size={14} />
              </Row>
            </Card>
          ) : (
            <Empty title="No notices available" />
          )}
          {data.booking && (
            <>
              <Section title="Something to look forward to" />
              <Card
                onPress={() => router.push("/bookings")}
                style={{ backgroundColor: c.pale }}
              >
                <Row>
                  <Icon name="tennisball-outline" size={31} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold">{data.booking.amenity_name}</Txt>
                    <Txt muted style={{ fontSize: 11 }}>
                      {date(data.booking.start_at)} ·{" "}
                      {time(data.booking.start_at)}
                    </Txt>
                  </View>
                  <Icon name="chevron-forward" size={18} />
                </Row>
              </Card>
            </>
          )}
          <Row style={{ justifyContent: "center", paddingTop: 12 }}>
            <Icon name="leaf-outline" size={14} color={c.muted} />
            <Txt muted style={{ fontSize: 10, letterSpacing: 1 }}>
              A HAPPIER PLACE TO CALL HOME
            </Txt>
          </Row>
        </>
      )}
    <EnableAlerts />
    </Screen>
  );
}
