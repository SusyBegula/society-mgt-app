import { View } from "react-native";
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
} from "../../src/components/ui";
import { useApi } from "../../src/lib/api";
import { money } from "../../src/lib/format";
import type { Amenity } from "../../src/types/api";
const palettes = ["#E6EFDF", "#E4EFF3", "#F5EAD8", "#EBE5F0"];
export default function Amenities() {
  const query = useApi<Amenity[]>("/amenities");
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header title="Make time for you" subtitle="Your community amenities." />
      <Button
        title="My bookings"
        secondary
        icon="calendar-outline"
        onPress={() => router.push("/bookings")}
      />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error} retry={query.refetch} />
      {query.data?.map((amenity, index) => (
        <Card
          key={amenity.id}
          onPress={() => router.push(`/amenities/${amenity.id}`)}
          style={{ padding: 0, overflow: "hidden" }}
        >
          <View
            style={{
              height: 120,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palettes[index % 4],
            }}
          >
            <View
              style={{
                width: 78,
                height: 78,
                borderRadius: 40,
                borderWidth: 1,
                borderColor: "#FFFFFFAA",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={amenity.icon as IconName} size={39} />
            </View>
          </View>
          <View style={{ paddingHorizontal: 19, paddingBottom: 19, gap: 9 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt weight="extra" style={{ fontSize: 20 }}>
                {amenity.name}
              </Txt>
              <Txt weight="bold" style={{ fontSize: 12 }}>
                {amenity.fee ? money(amenity.fee) : "Complimentary"}
              </Txt>
            </Row>
            <Txt muted style={{ fontSize: 12 }}>
              {amenity.description}
            </Txt>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt muted style={{ fontSize: 11 }}>
                {String(amenity.opens).padStart(2, "0")}:00–{amenity.closes}:00
              </Txt>
              <Txt weight="bold" style={{ fontSize: 12 }}>
                Book a slot →
              </Txt>
            </Row>
          </View>
        </Card>
      ))}
      {query.data?.length === 0 && <Empty title="No amenities listed yet" />}
    </Screen>
  );
}
