import { useState, useMemo } from "react";
import { View, TextInput, Alert, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Badge,
  Button,
  Chips,
  Loading,
  ErrorState,
  Empty,
  Icon,
  Divider,
  Avatar,
} from "../../src/components/ui";
import { useApi, request, ApiError } from "../../src/lib/api";
import { date } from "../../src/lib/format";
import { colors as c, fonts } from "../../src/theme";
import type { AdminMember } from "../../src/types/api";

const ROLE_FILTERS = ["All", "Owner", "Tenant", "Family", "Inactive"] as const;

export default function AdminMembersScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const membersQuery = useApi<{ items: AdminMember[] }>("/admin/members?limit=100");
  const members = membersQuery.data?.items || [];

  const filteredMembers = useMemo(() => {
    let result = members;

    // Filter by role or active status
    if (filter === "Inactive") {
      result = result.filter((m) => !m.active);
    } else if (filter !== "All") {
      result = result.filter((m) => m.role === filter);
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.phone.includes(q) ||
          m.flat.toLowerCase().includes(q) ||
          m.tower.toLowerCase().includes(q)
      );
    }

    return result;
  }, [members, filter, search]);

  const handleToggleStatus = (member: AdminMember) => {
    const actionLabel = member.active ? "Deactivate" : "Activate";
    Alert.alert(
      `${actionLabel} Member`,
      `Are you sure you want to ${actionLabel.toLowerCase()} ${member.name} (${member.tower} - ${member.flat})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: actionLabel,
          style: member.active ? "destructive" : "default",
          onPress: async () => {
            try {
              setTogglingId(member.id);
              await request(`/admin/members/${member.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ active: !member.active }),
              });
              await membersQuery.refetch();
              await queryClient.invalidateQueries({ queryKey: ["/admin/stats"] });
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Could not update member status.");
            } finally {
              setTogglingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen
      refresh={() => {
        void membersQuery.refetch();
      }}
    >
      <Header
        title="Member Directory"
        subtitle="Flats, resident assignments & approvals"
      />

      {/* Search Input */}
      <Card style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
        <Row style={{ alignItems: "center", gap: 10 }}>
          <Icon name="search-outline" color={c.muted} size={20} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, flat, tower, or phone..."
            placeholderTextColor="#9BA69F"
            style={{
              flex: 1,
              fontFamily: fonts.medium,
              fontSize: 14,
              color: c.ink,
              paddingVertical: 4,
            }}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Icon name="close-circle" color={c.muted} size={18} />
            </Pressable>
          ) : null}
        </Row>
      </Card>

      {/* Role / Status Filter Chips */}
      <Chips
        options={[...ROLE_FILTERS]}
        value={filter}
        onChange={setFilter}
      />

      {membersQuery.isLoading && <Loading />}
      <ErrorState error={membersQuery.error} retry={membersQuery.refetch} />

      {filteredMembers.length === 0 && !membersQuery.isLoading && (
        <Empty
          icon="people-outline"
          title="No Members Found"
          description={
            search ? "No residents matched your search query." : "No members under this filter."
          }
        />
      )}

      {filteredMembers.map((m) => (
        <Card key={m.id} style={{ gap: 10 }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Row style={{ alignItems: "center", gap: 12, flex: 1 }}>
              <Avatar name={m.name} size={44} />
              <View style={{ flex: 1 }}>
                <Row style={{ alignItems: "center", gap: 6 }}>
                  <Txt weight="bold" style={{ fontSize: 16 }}>
                    {m.name}
                  </Txt>
                  <Badge status={m.role} />
                </Row>
                <Txt muted style={{ fontSize: 13, marginTop: 2 }}>
                  {m.tower} · Flat {m.flat}
                </Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {m.phone}
                </Txt>
              </View>
            </Row>

            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Badge status={m.active ? "Active" : "Denied"} />
              <Button
                title={m.active ? "Deactivate" : "Activate"}
                danger={m.active}
                secondary
                loading={togglingId === m.id}
                onPress={() => handleToggleStatus(m)}
                style={{ minHeight: 34, paddingHorizontal: 12 }}
              />
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
