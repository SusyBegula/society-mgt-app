import { router } from "expo-router";
import { View } from "react-native";
import {
  Screen,
  Button,
  Header,
  Card,
  Txt,
  Row,
  Avatar,
  Badge,
  Icon,
  ListItem,
  Divider,
  Section,
  type IconName,
} from "../../src/components/ui";
import { useApi } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import type { Profile, Property } from "../../src/types/api";
const groups: { title: string; items: [IconName, string, string, string][] }[] =
  [
    {
      title: "My household",
      items: [
        ["cube-outline", "My parcels", "Deliveries and pickup codes", "/parcels"],
        [
          "people-outline",
          "Family members",
          "The people who make it home",
          "/family",
        ],
        [
          "car-outline",
          "Vehicles & parking",
          "Your vehicles and parking spaces",
          "/vehicles",
        ],
        [
          "person-outline",
          "Domestic help",
          "Visits, entries and exits",
          "/staff",
        ],
      ],
    },
    {
      title: "My community",
      items: [
        ["megaphone-outline", "Notice board", "Stay in the know", "/notices"],
        [
          "tennisball-outline",
          "Amenities",
          "Make time for yourself",
          "/amenities",
        ],
        ["calendar-outline", "My bookings", "Your upcoming plans", "/bookings"],
        [
          "folder-open-outline",
          "Society documents",
          "Everything in one place",
          "/documents",
        ],
        [
          "call-outline",
          "Society directory",
          "The right person, a tap away",
          "/directory",
        ],
        [
          "shield-checkmark-outline",
          "Emergency",
          "Get help quickly",
          "/emergency",
        ],
      ],
    },
    {
      title: "My account",
      items: [
        [
          "business-outline",
          "My properties",
          "Switch between your homes",
          "/properties?switch=true",
        ],
        [
          "settings-outline",
          "Settings",
          "Preferences, privacy and support",
          "/settings",
        ],
      ],
    },
  ];
export default function More() {
  const profile = useApi<Profile>("/residents/me");
  const property = useSession((s) => s.property)!;
  const propertiesQuery = useApi<Property[]>("/properties");
  const staffRole = propertiesQuery.data?.find((p) => p.context_type === "staff");

  return (
    <Screen>
      <Button title="Meetings and polls" secondary onPress={()=>router.push("/community" as never)} />
      <Button title="Privacy requests" secondary onPress={()=>router.push("/privacy" as never)} />
      <Header
        title="A little more"
        subtitle="Everything else, right here."
        back={false}
      />
      <Card onPress={() => router.push("/profile")}>
        <Row>
          <Avatar name={profile.data?.name ?? "Resident"} size={57} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt weight="extra" style={{ fontSize: 18 }}>
              {profile.data?.name ?? "Your profile"}
            </Txt>
            <Txt muted style={{ fontSize: 12 }}>
              {property.tower} · Flat {property.flat}
            </Txt>
          </View>
          <Badge status={property.role} />
        </Row>
      </Card>

      {staffRole && (
        <Card
          style={{ backgroundColor: "#F1F8E9", borderColor: "#C8E6C9" }}
          onPress={async () => {
            await useSession.getState().setProperty(staffRole);
            if (staffRole.role === "Guard") {
              router.push("/guard" as never);
            } else {
              router.push("/admin" as never);
            }
          }}
        >
          <Row style={{ alignItems: "center" }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "#E8F5E9",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Icon name="briefcase-outline" color="#2E7D32" size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="bold" style={{ fontSize: 15, color: "#1B5E20" }}>
                {staffRole.role === "Guard"
                  ? "Security Guard Desk"
                  : "Management Committee Desk"}
              </Txt>
              <Txt muted style={{ fontSize: 12 }}>
                Switch to {staffRole.society} ({staffRole.role})
              </Txt>
            </View>
            <Badge status={staffRole.role} />
          </Row>
        </Card>
      )}
      {groups.map((group) => (
        <View key={group.title} style={{ gap: 13 }}>
          <Section title={group.title} />
          <Card style={{ paddingVertical: 3 }}>
            {group.items.map(([icon, title, subtitle, route], index) => (
              <View key={title}>
                {index > 0 && <Divider />}
                <ListItem
                  icon={icon}
                  title={title}
                  subtitle={subtitle}
                  onPress={() => router.push(route as never)}
                />
              </View>
            ))}
          </Card>
        </View>
      ))}
      <Txt muted style={{ textAlign: "center", fontSize: 11 }}>
        neighbourly · Made for everyday community life
      </Txt>
    </Screen>
  );
}
