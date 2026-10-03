import { useState } from "react";
import { View, Pressable, Alert, Linking } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Screen,
  Txt,
  Row,
  IconButton,
  Icon,
  Card,
  Section,
  Badge,
  Loading,
  ErrorState,
  Empty,
  Button,
  type IconName,
} from "../../src/components/ui";
import { useApi, request } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import { time } from "../../src/lib/format";
import { colors as c } from "../../src/theme";
import type { ActiveVisitor, ActiveParcel } from "../../src/types/api";
import { Action, EnableAlerts } from "../../src/components/office";

const guardActions: {
  title: string;
  subtitle: string;
  icon: IconName;
  route: string;
  bg: string;
  color: string;
}[] = [
  {title:"Domestic Help",subtitle:"Record attendance and departures",icon:"people-outline",route:"/guard/help",bg:"#E3F2FD",color:"#1565C0"},
  {title: "Emergency Response", subtitle: "Acknowledge resident alerts", icon: "alert-circle-outline", route: "/guard/emergencies", bg: "#FFEBEE", color: "#C62828"},
  {
    title: "Verify Visitor Pass",
    subtitle: "Scan QR or 6-digit PIN",
    icon: "shield-checkmark-outline",
    route: "/guard/verify",
    bg: "#E8F5E9",
    color: "#2E7D32",
  },
  {
    title: "Log Walk-in Entry",
    subtitle: "Cab, Guest, or Service",
    icon: "person-add-outline",
    route: "/guard/walk-in",
    bg: "#E3F2FD",
    color: "#1565C0",
  },
  {
    title: "Parcel Delivery Desk",
    subtitle: "Log packages & OTP pickup",
    icon: "cube-outline",
    route: "/guard/parcels",
    bg: "#FFF3E0",
    color: "#E65100",
  },
  {
    title: "Society Directory",
    subtitle: "Emergency & Office numbers",
    icon: "call-outline",
    route: "/directory",
    bg: "#F3E5F5",
    color: "#7B1FA2",
  },
];

export default function GuardHome() {
  const property = useSession((s) => s.property);
  const client = useQueryClient();
  const [exitingId, setExitingId] = useState<string | null>(null);

  const visitorsQuery = useApi<ActiveVisitor[]>("/guard/visitors/active");
  const parcelsQuery = useApi<ActiveParcel[]>("/guard/parcels/active");
  const queue = useApi<any[]>("/guard/visitors/queue", 5000);

  const visitors = visitorsQuery.data || [];
  const parcels = parcelsQuery.data || [];

  const handleCheckOut = async (visitor: ActiveVisitor) => {
    Alert.alert(
      "Confirm Exit",
      `Mark ${visitor.name} (visiting ${visitor.tower} - ${visitor.flat}) as exited?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Exit",
          style: "destructive",
          onPress: async () => {
            try {
              setExitingId(visitor.id);
              await request(`/guard/visitors/${visitor.id}/check-out`, { method: "POST" });
              await visitorsQuery.refetch();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Could not check out visitor.");
            } finally {
              setExitingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen
      refresh={() => {
        void Promise.all([visitorsQuery.refetch(), parcelsQuery.refetch()]);
      }}
    >
      {/* Top Header with Guard Context & Role Switcher */}
      <View style={{ paddingTop: 10, paddingBottom: 16 }}>
        <Row style={{ alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Row style={{ alignItems: "center", gap: 6 }}>
              <Icon name="shield-checkmark" size={18} color="#2E7D32" />
              <Txt weight="extra" style={{ fontSize: 20, color: c.ink }}>
                {property?.society || "Gate Control"}
              </Txt>
            </Row>
            <Txt muted style={{ fontSize: 13, marginTop: 2 }}>
              Gatekeeper Operations · {property?.flat || "Main Gate"}
            </Txt>
          </View>
          <Row style={{ gap: 8 }}>
            <IconButton
              name="swap-horizontal"
              label="Switch Property"
              onPress={() => router.push("/properties?switch=true")}
            />
            <IconButton
              name="log-out-outline"
              label="Sign Out"
              onPress={() => {
                void useSession.getState().clear();
                client.clear();
                router.replace("/welcome");
              }}
            />
          </Row>
        </Row>
      </View>

      <EnableAlerts />
      {/* Live Status Cards */}
      <Section title="Visitor approvals" />
      <ErrorState error={queue.error} retry={queue.refetch} />
      <Txt muted>Entry requires resident approval. If the app or network is unavailable, follow the society's manual gate procedure and record the incident with the office.</Txt>
      {queue.data?.map(v => <Card key={v.id}>
        <Txt weight="bold">{v.name} · {v.tower} / {v.flat}</Txt><Badge status={v.status} />
        <Txt>{v.purpose}</Txt>
        {v.status === "Allowed" && <Action title="Record entry" path={`/guard/visitors/${v.id}/admit`} after={() => void visitorsQuery.refetch()} />}
        {v.status === "Waiting" && <Button title="Call resident" secondary onPress={() => {
          void request<{name: string; phone: string}[]>(`/guard/visitors/${v.id}/contacts`).then(contacts => {
            if (!contacts.length) {Alert.alert("No contact", "Contact the society office."); return;}
            Alert.alert("Call for visitor approval", "Ask the resident to approve the request in their app.", [
              ...contacts.slice(0, 2).map(c => ({text: c.name, onPress: () => {void Linking.openURL(`tel:${c.phone}`);}})), {text: "Cancel", style: "cancel" as const}]);
          }).catch(e => Alert.alert("Could not load contacts", e.message));
        }} />}
      </Card>)}
      <Row style={{ gap: 12, marginBottom: 16 }}>
        <Card style={{ flex: 1, backgroundColor: "#E8F5E9", borderColor: "#C8E6C9" }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Icon name="people" color="#2E7D32" size={24} />
            <Txt weight="extra" style={{ fontSize: 28, color: "#2E7D32" }}>
              {visitors.length}
            </Txt>
          </Row>
          <Txt weight="bold" style={{ color: "#2E7D32", marginTop: 4, fontSize: 13 }}>
            Visitors Inside
          </Txt>
          <Txt style={{ color: "#2E7D32", fontSize: 11, opacity: 0.8 }}>
            Currently in society
          </Txt>
        </Card>

        <Card
          style={{ flex: 1, backgroundColor: "#FFF3E0", borderColor: "#FFE0B2" }}
          onPress={() => router.push("/guard/parcels")}
        >
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Icon name="cube" color="#E65100" size={24} />
            <Txt weight="extra" style={{ fontSize: 28, color: "#E65100" }}>
              {parcels.length}
            </Txt>
          </Row>
          <Txt weight="bold" style={{ color: "#E65100", marginTop: 4, fontSize: 13 }}>
            Pending Parcels
          </Txt>
          <Txt style={{ color: "#E65100", fontSize: 11, opacity: 0.8 }}>
            Waiting at gate desk
          </Txt>
        </Card>
      </Row>

      {/* Main Guard Action Buttons */}
      <Section title="Gate Commands" />
      <View style={{ gap: 10 }}>
        {guardActions.map((action) => (
          <Card
            key={action.title}
            onPress={() => router.push(action.route as never)}
            style={{
              backgroundColor: "#fff",
              borderLeftWidth: 4,
              borderLeftColor: action.color,
              paddingVertical: 14,
            }}
          >
            <Row style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: action.bg,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <Icon name={action.icon} color={action.color} size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" style={{ fontSize: 15, color: c.ink }}>
                  {action.title}
                </Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {action.subtitle}
                </Txt>
              </View>
              <Icon name="chevron-forward" color={c.muted} size={18} />
            </Row>
          </Card>
        ))}
      </View>

      {/* Active Visitors Inside List */}
      <Section
        title={`Visitors Inside (${visitors.length})`}
        action="Refresh"
        onPress={() => void visitorsQuery.refetch()}
      />
      {visitorsQuery.isLoading && <Loading />}
        <ErrorState error={visitorsQuery.error} retry={visitorsQuery.refetch} />

        {visitors.length === 0 && !visitorsQuery.isLoading && (
          <Empty
            icon="checkmark-circle-outline"
            title="Gate is Clear"
            description="No visitors are currently marked inside the premises."
          />
        )}

        {visitors.map((v) => (
          <Card key={v.id} style={{ marginBottom: 10, paddingVertical: 12 }}>
            <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Row style={{ alignItems: "center", gap: 8 }}>
                  <Txt weight="bold" style={{ fontSize: 16 }}>
                    {v.name}
                  </Txt>
                  <Badge status="Inside" />
                </Row>
                <Txt muted style={{ fontSize: 13, marginTop: 3 }}>
                  Destination:{" "}
                  <Txt weight="semibold" style={{ color: c.ink }}>
                    {v.tower} · Flat {v.flat}
                  </Txt>
                </Txt>
                <Txt muted style={{ fontSize: 12, marginTop: 2 }}>
                  {v.purpose} · Entered {time(v.entry_at)}
                </Txt>
              </View>

              <Button
                title="Mark Exit"
                danger
                secondary
                loading={exitingId === v.id}
                onPress={() => void handleCheckOut(v)}
                style={{ minHeight: 38, paddingHorizontal: 12 }}
              />
            </Row>
          </Card>
        ))}
    </Screen>
  );
}
