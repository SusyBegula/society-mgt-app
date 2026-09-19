import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Button,
  Loading,
  ErrorState,
  Confirm,
} from "../../src/components/ui";
import { useApi, useAction, send } from "../../src/lib/api";
import { date, time, localDay, money } from "../../src/lib/format";
import { colors as c } from "../../src/theme";
import type { Amenity } from "../../src/types/api";
type Slot = { start_at: string; end_at: string; available: boolean };
export default function AmenityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [day, setDay] = useState(localDay());
  const [slot, setSlot] = useState<Slot | null>(null);
  const [confirm, setConfirm] = useState(false);
  const query = useApi<{ amenity: Amenity; slots: Slot[] }>(
    `/amenities/${id}/slots?day=${day}`,
  );
  const action = useAction(async () => {
    await send("/bookings", "POST", {
      amenity_id: id,
      start_at: slot!.start_at,
    });
    setConfirm(false);
    router.replace("/bookings");
  });
  const amenity = query.data?.amenity;
  return (
    <Screen>
      <Header title={amenity?.name ?? "Book an amenity"} />
      <Txt muted>{amenity?.description}</Txt>
      <Txt weight="bold">Choose a date</Txt>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 9 }}
      >
        {Array.from({ length: 30 }, (_, index) => localDay(index)).map(
          (value) => (
            <Pressable
              key={value}
              onPress={() => {
                setDay(value);
                setSlot(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: day === value }}
              style={{
                width: 68,
                borderRadius: 15,
                paddingVertical: 14,
                backgroundColor: day === value ? c.primary : c.surface,
                borderWidth: 1,
                borderColor: c.line,
                alignItems: "center",
                gap: 5,
              }}
            >
              <Txt
                style={{
                  fontSize: 10,
                  color: day === value ? "#FFFFFFCC" : c.muted,
                }}
              >
                {date(`${value}T12:00:00`, { weekday: "short" })}
              </Txt>
              <Txt
                weight="extra"
                style={{ fontSize: 21, color: day === value ? "#fff" : c.ink }}
              >
                {value.slice(-2)}
              </Txt>
              <Txt
                style={{
                  fontSize: 10,
                  color: day === value ? "#FFFFFFCC" : c.muted,
                }}
              >
                {date(`${value}T12:00:00`, { month: "short" })}
              </Txt>
            </Pressable>
          ),
        )}
      </ScrollView>
      <Txt weight="bold">Available slots · 1 hour</Txt>
      {query.isLoading && <Loading />}
      <ErrorState error={query.error || action.error} retry={query.refetch} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
        {query.data?.slots.map((value) => (
          <Pressable
            key={value.start_at}
            disabled={!value.available}
            onPress={() => setSlot(value)}
            accessibilityRole="button"
            accessibilityState={{
              disabled: !value.available,
              selected: slot?.start_at === value.start_at,
            }}
            style={{
              minWidth: "30%",
              paddingHorizontal: 13,
              paddingVertical: 15,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor:
                slot?.start_at === value.start_at ? c.pale : c.surface,
              opacity: value.available ? 1 : 0.35,
            }}
          >
            <Txt
              style={{ fontSize: 12, textAlign: "center" }}
              weight="semibold"
            >
              {time(value.start_at)}
            </Txt>
          </Pressable>
        ))}
      </View>
      {amenity && (
        <Card>
          <Txt weight="bold">
            {amenity.fee
              ? `${money(amenity.fee)} · Pay at society office`
              : "Complimentary for residents"}
          </Txt>
          <Txt muted style={{ fontSize: 12 }}>
            Cancel at least {amenity.cancel_hours} hours before your booking.
            Each slot is reserved exclusively for your flat.
          </Txt>
        </Card>
      )}
      <Button
        title="Review booking"
        disabled={!slot}
        onPress={() => setConfirm(true)}
      />
      <Confirm
        visible={confirm}
        title="Confirm your booking"
        message={`${amenity?.name}\n${slot ? `${date(slot.start_at)} · ${time(slot.start_at)}–${time(slot.end_at)}` : ""}\n${amenity?.fee ? `${money(amenity.fee)} payable at the office` : "No booking fee"}`}
        onCancel={() => setConfirm(false)}
        onConfirm={() => action.mutate()}
        loading={action.isPending}
      />
    </Screen>
  );
}
