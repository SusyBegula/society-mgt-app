import { useState } from "react";
import { View, TextInput, Alert, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
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
  DetailRow,
} from "../../src/components/ui";
import { useApi, request, ApiError } from "../../src/lib/api";
import { date, time } from "../../src/lib/format";
import { colors as c, fonts } from "../../src/theme";
import type { AdminComplaint } from "../../src/types/api";

const STATUS_FILTERS = ["All", "Open", "In Progress", "Resolved", "Closed"] as const;
const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed"] as const;
const PRIORITY_OPTIONS = ["Low", "Normal", "High", "Urgent"] as const;

export default function AdminComplaintsScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("All");

  const endpoint =
    filter === "All"
      ? "/admin/complaints"
      : `/admin/complaints?status=${encodeURIComponent(filter)}`;

  const complaintsQuery = useApi<{ items: AdminComplaint[] }>(endpoint);
  const complaints = complaintsQuery.data?.items || [];

  // Triage modal state
  const [selectedComplaint, setSelectedComplaint] = useState<AdminComplaint | null>(null);
  const [statusVal, setStatusVal] = useState<"Open" | "In Progress" | "Resolved" | "Closed">("Open");
  const [priorityVal, setPriorityVal] = useState<"Low" | "Normal" | "High" | "Urgent">("Normal");
  const [assignedTo, setAssignedTo] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const openTriageModal = (item: AdminComplaint) => {
    setSelectedComplaint(item);
    setStatusVal(item.status as any || "Open");
    setPriorityVal(item.priority as any || "Normal");
    setAssignedTo(item.assigned_to || "");
    setComment("");
    setModalError(null);
  };

  const handleSaveTriage = async () => {
    if (!selectedComplaint) return;
    try {
      setSaving(true);
      setModalError(null);
      await request(`/admin/complaints/${selectedComplaint.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: statusVal,
          priority: priorityVal,
          assigned_to: assignedTo.trim() || null,
          comment: comment.trim() || null,
        }),
      });

      await complaintsQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["/admin/stats"] });
      setSelectedComplaint(null);
      Alert.alert(
        "Complaint Updated",
        `Status set to "${statusVal}". Resident has been notified.`
      );
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Could not update complaint.";
      setModalError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      refresh={() => {
        void complaintsQuery.refetch();
      }}
    >
      <Header
        title="Complaint Triage"
        subtitle="Review, assign vendors & resolve resident issues"
      />

      {/* Filter Chips */}
      <Chips
        options={[...STATUS_FILTERS]}
        value={filter}
        onChange={setFilter}
      />

      {complaintsQuery.isLoading && <Loading />}
      <ErrorState error={complaintsQuery.error} retry={complaintsQuery.refetch} />

      {complaints.length === 0 && !complaintsQuery.isLoading && (
        <Empty
          icon="checkmark-circle-outline"
          title="No Complaints Found"
          description={
            filter === "All"
              ? "No issues have been reported."
              : `No complaints currently marked as ${filter}.`
          }
        />
      )}

      {complaints.map((item) => (
        <Card key={item.id} style={{ gap: 10 }}>
          <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Row style={{ alignItems: "center", gap: 6 }}>
                <Txt weight="bold" style={{ fontSize: 16 }}>
                  {item.tower} · Flat {item.flat}
                </Txt>
                <Badge status={item.status} />
              </Row>
              <Txt muted style={{ fontSize: 12, marginTop: 2 }}>
                Reported by {item.resident_name} ({item.resident_phone})
              </Txt>
            </View>
            <Badge status={item.priority} />
          </Row>

          <View style={{ gap: 4 }}>
            <Txt weight="bold" style={{ fontSize: 15 }}>
              {item.title}
            </Txt>
            <Txt muted style={{ fontSize: 13, lineHeight: 20 }}>
              {item.description}
            </Txt>
          </View>

          <Divider />

          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Txt muted style={{ fontSize: 11 }}>
                Category: <Txt weight="semibold" style={{ color: c.ink }}>{item.category}</Txt>
              </Txt>
              <Txt muted style={{ fontSize: 11 }}>
                Assigned: <Txt weight="semibold" style={{ color: c.ink }}>{item.assigned_to || "Unassigned"}</Txt>
              </Txt>
            </View>
            <Button
              title="Triage & Update"
              secondary
              onPress={() => openTriageModal(item)}
              style={{ minHeight: 38, paddingHorizontal: 14 }}
            />
          </Row>
        </Card>
      ))}

      {/* TRIAGE MODAL */}
      <Modal
        visible={!!selectedComplaint}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedComplaint(null)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            <Card style={styles.modalContent}>
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Txt weight="bold" style={{ fontSize: 18 }}>
                  Triage Complaint
                </Txt>
                <Pressable onPress={() => setSelectedComplaint(null)} style={{ padding: 4 }}>
                  <Icon name="close" size={22} color={c.muted} />
                </Pressable>
              </Row>

              <Txt muted style={{ fontSize: 13 }}>
                {selectedComplaint?.tower} - {selectedComplaint?.flat}: {selectedComplaint?.title}
              </Txt>

              <Divider />

              {/* Status Chips */}
              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Update Status
                </Txt>
                <Chips
                  options={[...STATUS_OPTIONS]}
                  value={statusVal}
                  onChange={(val) => setStatusVal(val as any)}
                />
              </View>

              {/* Priority Chips */}
              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Set Priority
                </Txt>
                <Chips
                  options={[...PRIORITY_OPTIONS]}
                  value={priorityVal}
                  onChange={(val) => setPriorityVal(val as any)}
                />
              </View>

              {/* Assigned To */}
              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Assign Technician / Staff
                </Txt>
                <TextInput
                  value={assignedTo}
                  onChangeText={setAssignedTo}
                  placeholder="e.g. Ramesh Electrician, Housekeeping Team"
                  placeholderTextColor="#9BA69F"
                  style={styles.textInput}
                />
              </View>

              {/* Note / Comment for Resident */}
              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Update Note (Delivered to Resident)
                </Txt>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="e.g. Technician will visit flat today at 3:00 PM."
                  placeholderTextColor="#9BA69F"
                  multiline
                  style={[styles.textInput, { minHeight: 70, textAlignVertical: "top" }]}
                />
              </View>

              {modalError && (
                <Row style={{ alignItems: "center", gap: 6, backgroundColor: c.redBg, padding: 10, borderRadius: 10 }}>
                  <Icon name="alert-circle-outline" color={c.red} size={18} />
                  <Txt style={{ color: c.red, fontSize: 13, flex: 1 }}>{modalError}</Txt>
                </Row>
              )}

              <Button
                title="Save & Notify Resident"
                loading={saving}
                onPress={() => void handleSaveTriage()}
              />
            </Card>
          </ScrollView>
        </View>
      </Modal>
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
    padding: 12,
    minHeight: 48,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    gap: 14,
    maxHeight: "90%",
  },
});
