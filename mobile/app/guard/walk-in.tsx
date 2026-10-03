import { useState, useMemo } from "react";
import { View, TextInput, Alert, StyleSheet, Pressable, ScrollView } from "react-native";
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
  Loading,
  ErrorState,
  type IconName,
} from "../../src/components/ui";
import { useApi, request, ApiError } from "../../src/lib/api";
import { phone as formatPhone } from "../../src/lib/format";
import { colors as c, fonts } from "../../src/theme";
import type { GuardUnit } from "../../src/types/api";

const KINDS = ["Guest", "Delivery", "Cab", "Service"] as const;

export default function WalkInScreen() {
  const queryClient = useQueryClient();
  const unitsQuery = useApi<GuardUnit[]>("/guard/units");
  const units = unitsQuery.data || [];

  const [unitSearch, setUnitSearch] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<GuardUnit | null>(null);
  const [kind, setKind] = useState<"Guest" | "Delivery" | "Cab" | "Service">("Guest");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successUnit, setSuccessUnit] = useState<string | null>(null);

  // Filter units by search text
  const filteredUnits = useMemo(() => {
    if (!unitSearch.trim()) return units.slice(0, 15);
    const q = unitSearch.toLowerCase().trim();
    return units
      .filter((u) => u.flat.toLowerCase().includes(q) || u.tower.toLowerCase().includes(q))
      .slice(0, 15);
  }, [units, unitSearch]);

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!selectedUnit) {
      setErrorMsg("Please select the destination flat/unit.");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("Please enter the visitor's name.");
      return;
    }
    if (mobile.trim().length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!purpose.trim()) {
      setErrorMsg("Please specify the purpose or service name.");
      return;
    }

    try {
      setSubmitting(true);
      await request("/guard/visitors/walk-in", {
        method: "POST",
        body: JSON.stringify({
          unit_id: selectedUnit.id,
          name: name.trim(),
          phone: formatPhone(mobile.trim()),
          kind,
          purpose: purpose.trim(),
        }),
      });

      await queryClient.invalidateQueries({ queryKey: ["/guard/visitors/active"] });
      setSuccessUnit(`${selectedUnit.tower} · Flat ${selectedUnit.flat}`);
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Could not log walk-in entry.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedUnit(null);
    setUnitSearch("");
    setName("");
    setMobile("");
    setPurpose("");
    setErrorMsg(null);
    setSuccessUnit(null);
  };

  if (successUnit) {
    return (
      <Screen>
        <Header title="Walk-in Entry Logged" />
        <Card style={{ alignItems: "center", gap: 14, paddingVertical: 28, backgroundColor: "#E8F5E9" }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: "#2E7D32",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="checkmark" color="#fff" size={34} />
          </View>

          <Txt weight="extra" style={{ fontSize: 20, color: "#1B5E20", textAlign: "center" }}>
            Entry Approved & Recorded
          </Txt>

          <Txt muted style={{ textAlign: "center", maxWidth: 280, fontSize: 13 }}>
            {name} ({kind}) is now marked inside visiting {successUnit}. Push notification sent to the resident.
          </Txt>

          <View style={{ width: "100%", gap: 10, marginTop: 12 }}>
            <Button title="Log Another Walk-in" onPress={resetForm} />
            <Button
              title="Return to Gate Dashboard"
              secondary
              onPress={() => router.replace("/guard" as never)}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Log Walk-in Entry"
        subtitle="Register unannounced guests, cabs, services"
      />

      {unitsQuery.isLoading && <Loading />}
      <ErrorState error={unitsQuery.error} retry={unitsQuery.refetch} />

      {/* Destination Flat Selector */}
      <Card style={{ gap: 12 }}>
        <Txt weight="bold" style={{ fontSize: 15 }}>
          Destination Flat / Unit
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
                <Txt style={{ color: "#2E7D32", fontSize: 11 }}>Selected Destination</Txt>
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
              placeholder="Search tower or flat number (e.g. 1204, A)"
              placeholderTextColor="#9BA69F"
              style={styles.textInput}
            />

            <Txt muted style={{ fontSize: 12 }}>
              Choose unit:
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

      {/* Visitor Category Chips */}
      <Card style={{ gap: 10 }}>
        <Txt weight="bold" style={{ fontSize: 15 }}>
          Visitor Category
        </Txt>
        <Chips
          options={[...KINDS]}
          value={kind}
          onChange={(val) => {
            setKind(val as any);
            if (val === "Cab" && !purpose) setPurpose("Cab Pickup / Drop");
            if (val === "Delivery" && !purpose) setPurpose("Delivery Package");
            if (val === "Guest" && purpose.includes("Cab")) setPurpose("");
          }}
        />
      </Card>

      {/* Visitor Details */}
      <Card style={{ gap: 14 }}>
        <Txt weight="bold" style={{ fontSize: 15 }}>
          Visitor Details
        </Txt>

        <View style={{ gap: 6 }}>
          <Txt weight="semibold" style={{ fontSize: 12 }}>
            Visitor Name *
          </Txt>
          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              setErrorMsg(null);
            }}
            placeholder="e.g. Rajesh Kumar or Delivery Partner"
            placeholderTextColor="#9BA69F"
            style={styles.textInput}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Txt weight="semibold" style={{ fontSize: 12 }}>
            Mobile Number (+91) *
          </Txt>
          <TextInput
            value={mobile}
            onChangeText={(text) => {
              setMobile(text);
              setErrorMsg(null);
            }}
            placeholder="10-digit number"
            placeholderTextColor="#9BA69F"
            keyboardType="phone-pad"
            maxLength={10}
            style={styles.textInput}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Txt weight="semibold" style={{ fontSize: 12 }}>
            Purpose / Company *
          </Txt>
          <TextInput
            value={purpose}
            onChangeText={(text) => {
              setPurpose(text);
              setErrorMsg(null);
            }}
            placeholder="e.g. Swiggy, Uber, Friend, Electrician"
            placeholderTextColor="#9BA69F"
            style={styles.textInput}
          />
        </View>

        {errorMsg && (
          <Row style={{ alignItems: "center", gap: 6, backgroundColor: c.redBg, padding: 10, borderRadius: 10 }}>
            <Icon name="alert-circle-outline" color={c.red} size={18} />
            <Txt style={{ color: c.red, fontSize: 13, flex: 1 }}>{errorMsg}</Txt>
          </Row>
        )}

        <Button
          title="Approve Entry & Mark Inside"
          loading={submitting}
          onPress={() => void handleSubmit()}
          style={{ marginTop: 6 }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
