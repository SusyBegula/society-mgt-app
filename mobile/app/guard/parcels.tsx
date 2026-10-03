import { useState, useMemo } from "react";
import { View, TextInput, Alert, StyleSheet, Pressable, Modal } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Icon,
  Badge,
  Button,
  Chips,
  Empty,
  Loading,
  ErrorState,
  DetailRow,
  Divider,
} from "../../src/components/ui";
import { useApi, request, ApiError } from "../../src/lib/api";
import { time } from "../../src/lib/format";
import { colors as c, fonts } from "../../src/theme";
import type { ActiveParcel, GuardUnit } from "../../src/types/api";

const COURIERS = [
  "Amazon",
  "Flipkart",
  "Delhivery",
  "Swiggy",
  "BlueDart",
  "DTDC",
  "Other",
];

export default function ParcelsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pending" | "log">("pending");

  // Query pending parcels
  const parcelsQuery = useApi<ActiveParcel[]>("/guard/parcels/active");
  const parcels = parcelsQuery.data || [];

  // Query society units for logging
  const unitsQuery = useApi<GuardUnit[]>("/guard/units");
  const units = unitsQuery.data || [];

  // Handover state
  const [handoverParcel, setHandoverParcel] = useState<ActiveParcel | null>(null);
  const [handoverOtp, setHandoverOtp] = useState("");
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);

  // Log form state
  const [selectedUnit, setSelectedUnit] = useState<GuardUnit | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [courier, setCourier] = useState("Amazon");
  const [recipient, setRecipient] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [loggedParcel, setLoggedParcel] = useState<{ otp: string; flat: string; courier: string } | null>(null);

  const filteredUnits = useMemo(() => {
    if (!unitSearch.trim()) return units.slice(0, 12);
    const q = unitSearch.toLowerCase().trim();
    return units
      .filter((u) => u.flat.toLowerCase().includes(q) || u.tower.toLowerCase().includes(q))
      .slice(0, 12);
  }, [units, unitSearch]);

  const handleHandover = async () => {
    if (!handoverParcel) return;
    if (handoverOtp.trim().length < 4) {
      setHandoverError("Please enter the 4-digit pickup OTP.");
      return;
    }

    try {
      setHandoverLoading(true);
      setHandoverError(null);
      await request(`/guard/parcels/${handoverParcel.id}/collect`, {
        method: "POST",
        body: JSON.stringify({ otp: handoverOtp.trim() }),
      });

      await parcelsQuery.refetch();
      setHandoverParcel(null);
      setHandoverOtp("");
      Alert.alert(
        "Package Handed Over",
        `Successfully delivered to ${handoverParcel.tower} - ${handoverParcel.flat}.`
      );
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Could not complete pickup.";
      setHandoverError(msg);
    } finally {
      setHandoverLoading(false);
    }
  };

  const handleLogParcel = async () => {
    setLogError(null);
    if (!selectedUnit) {
      setLogError("Please select destination flat/unit.");
      return;
    }
    if (!courier.trim()) {
      setLogError("Please select or enter the courier name.");
      return;
    }

    try {
      setLogging(true);
      const res = await request<any>("/guard/parcels", {
        method: "POST",
        body: JSON.stringify({
          unit_id: selectedUnit.id,
          courier: courier.trim(),
          recipient_name: recipient.trim(),
          tracking_code: trackingCode.trim(),
        }),
      });

      await parcelsQuery.refetch();
      setLoggedParcel({
        otp: res.otp,
        flat: `${selectedUnit.tower} - ${selectedUnit.flat}`,
        courier: courier.trim(),
      });
      // Reset form
      setSelectedUnit(null);
      setRecipient("");
      setTrackingCode("");
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Could not log parcel.";
      setLogError(msg);
    } finally {
      setLogging(false);
    }
  };

  return (
    <Screen
      refresh={() => {
        void Promise.all([parcelsQuery.refetch(), unitsQuery.refetch()]);
      }}
    >
      <Header
        title="Parcel Delivery Desk"
        subtitle="Gate courier log & resident pickup OTP"
      />

      {/* Segmented Control Tabs */}
      <Row style={{ gap: 10 }}>
        <Pressable
          onPress={() => setActiveTab("pending")}
          style={[
            styles.tabButton,
            activeTab === "pending" && styles.tabButtonActive,
          ]}
        >
          <Txt
            weight="bold"
            style={{
              color: activeTab === "pending" ? "#fff" : c.ink,
              fontSize: 13,
            }}
          >
            At Gate ({parcels.length})
          </Txt>
        </Pressable>

        <Pressable
          onPress={() => {
            setActiveTab("log");
            setLoggedParcel(null);
          }}
          style={[
            styles.tabButton,
            activeTab === "log" && styles.tabButtonActive,
          ]}
        >
          <Txt
            weight="bold"
            style={{
              color: activeTab === "log" ? "#fff" : c.ink,
              fontSize: 13,
            }}
          >
            + Log New Package
          </Txt>
        </Pressable>
      </Row>

      {/* TAB 1: PENDING PARCELS AT GATE */}
      {activeTab === "pending" && (
        <View style={{ gap: 12 }}>
          {parcelsQuery.isLoading && <Loading />}
          <ErrorState error={parcelsQuery.error} retry={parcelsQuery.refetch} />

          {parcels.length === 0 && !parcelsQuery.isLoading && (
            <Card style={{ alignItems: "center", paddingVertical: 32 }}>
              <Empty
                icon="cube-outline"
                title="No Parcels at Gate"
                description="All received packages have been collected by residents."
              />
              <Button
                title="Log New Delivery"
                onPress={() => setActiveTab("log")}
                style={{ marginTop: 16 }}
              />
            </Card>
          )}

          {parcels.map((p) => (
            <Card key={p.id} style={{ gap: 10 }}>
              <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <Row style={{ alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: "#FFF3E0",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="cube" color="#E65100" size={22} />
                  </View>
                  <View>
                    <Txt weight="bold" style={{ fontSize: 16 }}>
                      {p.courier}
                    </Txt>
                    <Txt muted style={{ fontSize: 13 }}>
                      Destination:{" "}
                      <Txt weight="bold" style={{ color: c.ink }}>
                        {p.tower} · Flat {p.flat}
                      </Txt>
                    </Txt>
                  </View>
                </Row>
                <Badge status="Active" />
              </Row>

              <Divider />

              {p.recipient_name ? (
                <DetailRow label="Recipient" value={p.recipient_name} />
              ) : null}
              {p.tracking_code ? (
                <DetailRow label="Tracking/Code" value={p.tracking_code} />
              ) : null}
              <DetailRow label="Logged At" value={time(p.created_at)} />

              <Button
                title="Handover (Verify OTP)"
                onPress={() => {
                  setHandoverParcel(p);
                  setHandoverOtp("");
                  setHandoverError(null);
                }}
                style={{ marginTop: 6 }}
              />
            </Card>
          ))}
        </View>
      )}

      {/* TAB 2: LOG NEW PACKAGE */}
      {activeTab === "log" && (
        <View style={{ gap: 14 }}>
          {/* Success card if parcel just logged */}
          {loggedParcel && (
            <Card style={{ backgroundColor: "#E8F5E9", borderColor: "#C8E6C9", alignItems: "center", gap: 10, paddingVertical: 20 }}>
              <Icon name="checkmark-circle" color="#2E7D32" size={36} />
              <Txt weight="extra" style={{ fontSize: 18, color: "#1B5E20" }}>
                Package Logged!
              </Txt>
              <Txt style={{ color: "#2E7D32", fontSize: 13 }}>
                {loggedParcel.courier} for {loggedParcel.flat}
              </Txt>
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: "#A5D6A7",
                  alignItems: "center",
                  marginVertical: 4,
                }}
              >
                <Txt muted style={{ fontSize: 11 }}>
                  Resident Pickup OTP:
                </Txt>
                <Txt weight="extra" style={{ fontSize: 24, letterSpacing: 4, color: "#2E7D32" }}>
                  {loggedParcel.otp}
                </Txt>
              </View>
              <Txt muted style={{ fontSize: 11, textAlign: "center" }}>
                Push notification with this OTP has been delivered to the flat.
              </Txt>
              <Row style={{ gap: 10, width: "100%", marginTop: 8 }}>
                <Button
                  title="Log Another"
                  onPress={() => setLoggedParcel(null)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="View Gate Desk"
                  secondary
                  onPress={() => setActiveTab("pending")}
                  style={{ flex: 1 }}
                />
              </Row>
            </Card>
          )}

          {!loggedParcel && (
            <>
              {/* Unit Picker */}
              <Card style={{ gap: 12 }}>
                <Txt weight="bold" style={{ fontSize: 15 }}>
                  Destination Flat / Unit *
                </Txt>

                {selectedUnit ? (
                  <Row
                    style={{
                      backgroundColor: "#E8F5E9",
                      borderColor: "#C8E6C9",
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 14,
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Row style={{ alignItems: "center", gap: 10 }}>
                      <Icon name="home" color="#2E7D32" size={24} />
                      <View>
                        <Txt weight="bold" style={{ color: "#1B5E20", fontSize: 16 }}>
                          {selectedUnit.tower} · Flat {selectedUnit.flat}
                        </Txt>
                        <Txt style={{ color: "#2E7D32", fontSize: 11 }}>Target Unit</Txt>
                      </View>
                    </Row>
                    <Button
                      title="Change"
                      secondary
                      onPress={() => setSelectedUnit(null)}
                      style={{ minHeight: 34, paddingHorizontal: 12 }}
                    />
                  </Row>
                ) : (
                  <View style={{ gap: 8 }}>
                    <TextInput
                      value={unitSearch}
                      onChangeText={setUnitSearch}
                      placeholder="Search tower or flat number (e.g. 1204)"
                      placeholderTextColor="#9BA69F"
                      style={styles.textInput}
                    />

                    <Txt muted style={{ fontSize: 12 }}>
                      Select destination flat:
                    </Txt>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {filteredUnits.map((u) => (
                        <Pressable
                          key={u.id}
                          onPress={() => {
                            setSelectedUnit(u);
                            setUnitSearch("");
                          }}
                          style={{
                            backgroundColor: "#fff",
                            borderWidth: 1,
                            borderColor: c.line,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          }}
                        >
                          <Txt weight="semibold" style={{ fontSize: 13, color: c.ink }}>
                            {u.tower} - {u.flat}
                          </Txt>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </Card>

              {/* Courier Chips */}
              <Card style={{ gap: 10 }}>
                <Txt weight="bold" style={{ fontSize: 15 }}>
                  Courier / Company *
                </Txt>
                <Chips
                  options={COURIERS}
                  value={courier}
                  onChange={setCourier}
                />
              </Card>

              {/* Recipient and Tracking */}
              <Card style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Txt weight="semibold" style={{ fontSize: 12 }}>
                    Recipient Name (Optional)
                  </Txt>
                  <TextInput
                    value={recipient}
                    onChangeText={setRecipient}
                    placeholder="e.g. Arjun Sharma"
                    placeholderTextColor="#9BA69F"
                    style={styles.textInput}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Txt weight="semibold" style={{ fontSize: 12 }}>
                    Tracking / Package Code (Optional)
                  </Txt>
                  <TextInput
                    value={trackingCode}
                    onChangeText={setTrackingCode}
                    placeholder="e.g. AWB-98234 or box number"
                    placeholderTextColor="#9BA69F"
                    style={styles.textInput}
                  />
                </View>

                {logError && (
                  <Row style={{ alignItems: "center", gap: 6, backgroundColor: c.redBg, padding: 10, borderRadius: 10 }}>
                    <Icon name="alert-circle-outline" color={c.red} size={18} />
                    <Txt style={{ color: c.red, fontSize: 13, flex: 1 }}>{logError}</Txt>
                  </Row>
                )}

                <Button
                  title="Log Package & Generate OTP"
                  loading={logging}
                  onPress={() => void handleLogParcel()}
                  style={{ marginTop: 6 }}
                />
              </Card>
            </>
          )}
        </View>
      )}

      {/* OTP HANDOVER MODAL */}
      <Modal
        visible={!!handoverParcel}
        transparent
        animationType="fade"
        onRequestClose={() => setHandoverParcel(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
              <Txt weight="bold" style={{ fontSize: 17 }}>
                Verify Pickup OTP
              </Txt>
              <Pressable
                onPress={() => setHandoverParcel(null)}
                style={{ padding: 4 }}
              >
                <Icon name="close" size={22} color={c.muted} />
              </Pressable>
            </Row>

            <Txt muted style={{ fontSize: 13 }}>
              Enter the 4-digit OTP shown in the resident's app ({handoverParcel?.tower} - {handoverParcel?.flat}):
            </Txt>

            <TextInput
              value={handoverOtp}
              onChangeText={(text) => {
                setHandoverOtp(text);
                setHandoverError(null);
              }}
              placeholder="4-digit OTP"
              placeholderTextColor="#9BA69F"
              keyboardType="number-pad"
              maxLength={4}
              style={[styles.textInput, styles.otpInput]}
            />

            {handoverError && (
              <Row style={{ alignItems: "center", gap: 6, backgroundColor: c.redBg, padding: 10, borderRadius: 10 }}>
                <Icon name="alert-circle-outline" color={c.red} size={18} />
                <Txt style={{ color: c.red, fontSize: 13, flex: 1 }}>{handoverError}</Txt>
              </Row>
            )}

            <Button
              title="Confirm Handover"
              loading={handoverLoading}
              onPress={() => void handleHandover()}
            />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  textInput: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: c.ink,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 13,
    padding: 14,
    minHeight: 50,
  },
  otpInput: {
    fontFamily: fonts.bold,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    marginVertical: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 22,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    gap: 14,
  },
});
