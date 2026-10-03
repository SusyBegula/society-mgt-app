import { View, Pressable } from "react-native";
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
import { useApi } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import { time, date } from "../../src/lib/format";
import { colors as c } from "../../src/theme";
import type { AdminStats, AdminComplaint } from "../../src/types/api";

const adminCommands: {
  title: string;
  subtitle: string;
  icon: IconName;
  route: string;
  bg: string;
  color: string;
}[] = [
  {
    title: "Broadcast Notice",
    subtitle: "Publish circulars & instant push alerts",
    icon: "megaphone-outline",
    route: "/admin/notices",
    bg: "#FFF8E1",
    color: "#F57F17",
  },
  {
    title: "Complaint Triage Hub",
    subtitle: "Assign technicians & resolve issues",
    icon: "chatbox-ellipses-outline",
    route: "/admin/complaints",
    bg: "#FFEBEE",
    color: "#C62828",
  },
  {
    title: "Treasury & Finance",
    subtitle: "Bulk billing, collections & defaulters",
    icon: "wallet-outline",
    route: "/admin/finance",
    bg: "#E8F5E9",
    color: "#2E7D32",
  },
  {
    title: "Member & Resident Directory",
    subtitle: "View flats, roles & toggle approvals",
    icon: "people-outline",
    route: "/admin/members",
    bg: "#E3F2FD",
    color: "#1565C0",
  },
  {
    title: "Gate Security Desk",
    subtitle: "Check-in passes, visitor log & parcels",
    icon: "shield-checkmark-outline",
    route: "/guard",
    bg: "#E8F5E9",
    color: "#2E7D32",
  },
];

export default function AdminHub() {
  const property = useSession((s) => s.property);
  const client = useQueryClient();

  const statsQuery = useApi<AdminStats>("/admin/stats");
  const complaintsQuery = useApi<{ items: AdminComplaint[] }>("/admin/complaints?limit=3");

  const stats = statsQuery.data;
  const recentComplaints = complaintsQuery.data?.items || [];

  return (
    <Screen
      refresh={() => {
        void Promise.all([statsQuery.refetch(), complaintsQuery.refetch()]);
      }}
    >
      {/* Header with Switch Property & Sign Out */}
      <View style={{ paddingTop: 10, paddingBottom: 16 }}>
        <Row style={{ alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Row style={{ alignItems: "center", gap: 6 }}>
              <Icon name="business" size={20} color={c.primary} />
              <Txt weight="extra" style={{ fontSize: 20, color: c.ink }}>
                {property?.society || "Society Administration"}
              </Txt>
            </Row>
            <Txt muted style={{ fontSize: 13, marginTop: 2 }}>
              Management Committee · {property?.role || "Admin"}
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

      {/* KPI Stats Cards */}
      {statsQuery.isLoading && <Loading />}
      <ErrorState error={statsQuery.error} retry={statsQuery.refetch} />

      {stats && (
        <View style={{ gap: 10, marginBottom: 8 }}>
          <Row style={{ gap: 10 }}>
            {/* Open Complaints */}
            <Card
              style={{ flex: 1, backgroundColor: "#FFEBEE", borderColor: "#FFCDD2" }}
              onPress={() => router.push("/admin/complaints")}
            >
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Icon name="alert-circle" color="#C62828" size={24} />
                <Txt weight="extra" style={{ fontSize: 26, color: "#C62828" }}>
                  {stats.open_complaints}
                </Txt>
              </Row>
              <Txt weight="bold" style={{ color: "#C62828", marginTop: 4, fontSize: 13 }}>
                Open Issues
              </Txt>
              <Txt style={{ color: "#C62828", fontSize: 11, opacity: 0.8 }}>
                Needs resolution
              </Txt>
            </Card>

            {/* Active Visitors */}
            <Card
              style={{ flex: 1, backgroundColor: "#E8F5E9", borderColor: "#C8E6C9" }}
              onPress={() => router.push("/guard")}
            >
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Icon name="people" color="#2E7D32" size={24} />
                <Txt weight="extra" style={{ fontSize: 26, color: "#2E7D32" }}>
                  {stats.active_visitors}
                </Txt>
              </Row>
              <Txt weight="bold" style={{ color: "#2E7D32", marginTop: 4, fontSize: 13 }}>
                Visitors Inside
              </Txt>
              <Txt style={{ color: "#2E7D32", fontSize: 11, opacity: 0.8 }}>
                Active at gates
              </Txt>
            </Card>
          </Row>

          <Row style={{ gap: 10 }}>
            {/* Active Parcels */}
            <Card
              style={{ flex: 1, backgroundColor: "#FFF3E0", borderColor: "#FFE0B2" }}
              onPress={() => router.push("/guard/parcels")}
            >
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Icon name="cube" color="#E65100" size={22} />
                <Txt weight="extra" style={{ fontSize: 22, color: "#E65100" }}>
                  {stats.active_parcels}
                </Txt>
              </Row>
              <Txt weight="bold" style={{ color: "#E65100", marginTop: 4, fontSize: 12 }}>
                Gate Parcels
              </Txt>
            </Card>

            {/* Total Members */}
            <Card
              style={{ flex: 1, backgroundColor: "#E3F2FD", borderColor: "#BBDEFB" }}
              onPress={() => router.push("/admin/members")}
            >
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Icon name="person" color="#1565C0" size={22} />
                <Txt weight="extra" style={{ fontSize: 22, color: "#1565C0" }}>
                  {stats.total_members}
                </Txt>
              </Row>
              <Txt weight="bold" style={{ color: "#1565C0", marginTop: 4, fontSize: 12 }}>
                Active Members
              </Txt>
            </Card>

            {/* Total Units */}
            <Card style={{ flex: 1, backgroundColor: "#F3E5F5", borderColor: "#E1BEE7" }}>
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Icon name="home" color="#6A1B9A" size={22} />
                <Txt weight="extra" style={{ fontSize: 22, color: "#6A1B9A" }}>
                  {stats.total_units}
                </Txt>
              </Row>
              <Txt weight="bold" style={{ color: "#6A1B9A", marginTop: 4, fontSize: 12 }}>
                Flats / Units
              </Txt>
            </Card>
          </Row>
        </View>
      )}

      {/* Main Admin Actions */}
      <Section title="Committee Operations" />
      <View style={{ gap: 10 }}>
        {adminCommands.map((cmd) => (
          <Card
            key={cmd.title}
            onPress={() => router.push(cmd.route as never)}
            style={{
              backgroundColor: "#fff",
              borderLeftWidth: 4,
              borderLeftColor: cmd.color,
              paddingVertical: 14,
            }}
          >
            <Row style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: cmd.bg,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <Icon name={cmd.icon} color={cmd.color} size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" style={{ fontSize: 15, color: c.ink }}>
                  {cmd.title}
                </Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {cmd.subtitle}
                </Txt>
              </View>
              <Icon name="chevron-forward" color={c.muted} size={18} />
            </Row>
          </Card>
        ))}
      </View>

      {/* Recent Complaints Section */}
      <Section
        title="Recent Society Complaints"
        action="View All"
        onPress={() => router.push("/admin/complaints")}
      />

      {complaintsQuery.isLoading && <Loading />}

      {recentComplaints.length === 0 && !complaintsQuery.isLoading && (
        <Empty
          icon="checkmark-circle-outline"
          title="No Issues Reported"
          description="Everything in the society is running smoothly."
        />
      )}

      {recentComplaints.map((item) => (
        <Card
          key={item.id}
          onPress={() => router.push("/admin/complaints")}
          style={{ gap: 8 }}
        >
          <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Row style={{ alignItems: "center", gap: 8 }}>
                <Txt weight="bold" style={{ fontSize: 15 }}>
                  {item.title}
                </Txt>
                <Badge status={item.status} />
              </Row>
              <Txt muted style={{ fontSize: 12, marginTop: 2 }}>
                {item.tower} · Flat {item.flat} · {item.resident_name}
              </Txt>
            </View>
            <Badge status={item.priority} />
          </Row>

          <Txt numberOfLines={2} muted style={{ fontSize: 13 }}>
            {item.description}
          </Txt>

          <Row style={{ justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <Txt muted style={{ fontSize: 11 }}>
              Reported {date(item.created_at)}
            </Txt>
            <Txt weight="semibold" style={{ color: c.primary, fontSize: 12 }}>
              Triage & Update →
            </Txt>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
