import { useState } from "react";
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
} from "../../src/components/ui";
import { usePages, request, ApiError } from "../../src/lib/api";
import { date } from "../../src/lib/format";
import { colors as c, fonts } from "../../src/theme";
import type { Notice } from "../../src/types/api";

const CATEGORIES = ["General", "Maintenance", "Rules", "Events", "Urgent"] as const;
const PRIORITIES = ["Normal", "Urgent"] as const;

export default function AdminNoticesScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"broadcast" | "list">("broadcast");

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"General" | "Maintenance" | "Rules" | "Events" | "Urgent">("General");
  const [priority, setPriority] = useState<"Normal" | "Urgent">("Normal");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBroadcast, setSuccessBroadcast] = useState(false);

  // Deleting notice state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Published Notices Query
  const noticesQuery = usePages<Notice>("/notices");
  const notices = noticesQuery.data?.pages.flatMap((p) => p.items) || [];

  const handlePublish = async () => {
    setErrorMsg(null);
    if (title.trim().length < 3) {
      setErrorMsg("Please enter a notice title (at least 3 characters).");
      return;
    }
    if (content.trim().length < 10) {
      setErrorMsg("Please provide notice details (at least 10 characters).");
      return;
    }

    try {
      setSubmitting(true);
      await request("/admin/notices", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          category,
          content: content.trim(),
          priority,
          attachments: [],
        }),
      });

      await noticesQuery.refetch();
      setSuccessBroadcast(true);
      setTitle("");
      setContent("");
      setCategory("General");
      setPriority("Normal");
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Failed to broadcast notice.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (notice: Notice) => {
    Alert.alert(
      "Delete Notice",
      `Are you sure you want to remove "${notice.title}" from the notice board?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Notice",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(notice.id);
              await request(`/admin/notices/${notice.id}`, { method: "DELETE" });
              await noticesQuery.refetch();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Could not delete notice.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen
      refresh={() => {
        void noticesQuery.refetch();
      }}
    >
      <Header
        title="Notice Board Desk"
        subtitle="Broadcast circulars and resident push alerts"
      />

      {/* Tabs */}
      <Row style={{ gap: 10 }}>
        <Pressable
          onPress={() => {
            setActiveTab("broadcast");
            setSuccessBroadcast(false);
          }}
          style={[
            styles.tabButton,
            activeTab === "broadcast" && styles.tabButtonActive,
          ]}
        >
          <Txt
            weight="bold"
            style={{
              color: activeTab === "broadcast" ? "#fff" : c.ink,
              fontSize: 13,
            }}
          >
            📢 Broadcast New
          </Txt>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("list")}
          style={[
            styles.tabButton,
            activeTab === "list" && styles.tabButtonActive,
          ]}
        >
          <Txt
            weight="bold"
            style={{
              color: activeTab === "list" ? "#fff" : c.ink,
              fontSize: 13,
            }}
          >
            Active Notices ({notices.length})
          </Txt>
        </Pressable>
      </Row>

      {/* TAB 1: BROADCAST NEW NOTICE */}
      {activeTab === "broadcast" && (
        <View style={{ gap: 14 }}>
          {successBroadcast && (
            <Card style={{ backgroundColor: "#E8F5E9", borderColor: "#C8E6C9", alignItems: "center", gap: 10, paddingVertical: 22 }}>
              <Icon name="checkmark-circle" color="#2E7D32" size={36} />
              <Txt weight="extra" style={{ fontSize: 18, color: "#1B5E20" }}>
                Notice Broadcasted!
              </Txt>
              <Txt style={{ color: "#2E7D32", fontSize: 13, textAlign: "center", maxWidth: 280 }}>
                The announcement is published on the notice board and sent as a push notification to all resident flats.
              </Txt>
              <Row style={{ gap: 10, width: "100%", marginTop: 8 }}>
                <Button
                  title="Broadcast Another"
                  onPress={() => setSuccessBroadcast(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="View Notice Board"
                  secondary
                  onPress={() => setActiveTab("list")}
                  style={{ flex: 1 }}
                />
              </Row>
            </Card>
          )}

          {!successBroadcast && (
            <Card style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Notice Headline *
                </Txt>
                <TextInput
                  value={title}
                  onChangeText={(text) => {
                    setTitle(text);
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. Water Tank Cleaning & Supply Interruption"
                  placeholderTextColor="#9BA69F"
                  style={styles.textInput}
                />
              </View>

              <View style={{ gap: 8 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Category *
                </Txt>
                <Chips
                  options={[...CATEGORIES]}
                  value={category}
                  onChange={(val) => setCategory(val as any)}
                />
              </View>

              <View style={{ gap: 8 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Broadcast Priority
                </Txt>
                <Chips
                  options={[...PRIORITIES]}
                  value={priority}
                  onChange={(val) => setPriority(val as any)}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Notice Content & Instructions *
                </Txt>
                <TextInput
                  value={content}
                  onChangeText={(text) => {
                    setContent(text);
                    setErrorMsg(null);
                  }}
                  placeholder="Detailed circular content for residents..."
                  placeholderTextColor="#9BA69F"
                  multiline
                  style={[styles.textInput, styles.multilineInput]}
                />
              </View>

              {errorMsg && (
                <Row style={{ alignItems: "center", gap: 6, backgroundColor: c.redBg, padding: 10, borderRadius: 10 }}>
                  <Icon name="alert-circle-outline" color={c.red} size={18} />
                  <Txt style={{ color: c.red, fontSize: 13, flex: 1 }}>{errorMsg}</Txt>
                </Row>
              )}

              <Button
                title={priority === "Urgent" ? "🚨 Broadcast Urgent Alert" : "Publish & Notify Residents"}
                loading={submitting}
                onPress={() => void handlePublish()}
                style={priority === "Urgent" ? { backgroundColor: "#C62828" } : undefined}
              />
            </Card>
          )}
        </View>
      )}

      {/* TAB 2: ACTIVE NOTICES LIST */}
      {activeTab === "list" && (
        <View style={{ gap: 12 }}>
          {noticesQuery.isLoading && <Loading />}
          <ErrorState error={noticesQuery.error} retry={noticesQuery.refetch} />

          {notices.length === 0 && !noticesQuery.isLoading && (
            <Empty
              icon="megaphone-outline"
              title="No Active Notices"
              description="No announcements currently published on the notice board."
            />
          )}

          {notices.map((n) => (
            <Card key={n.id} style={{ gap: 10 }}>
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Row style={{ alignItems: "center", gap: 6 }}>
                  <Badge status={n.category} />
                  {n.priority === "Urgent" && <Badge status="Urgent" />}
                </Row>
                <Txt muted style={{ fontSize: 11 }}>
                  {date(n.published_at)}
                </Txt>
              </Row>

              <Txt weight="bold" style={{ fontSize: 17 }}>
                {n.title}
              </Txt>

              <Txt muted style={{ fontSize: 13, lineHeight: 20 }}>
                {n.content}
              </Txt>

              <Divider />

              <Row style={{ justifyContent: "flex-end" }}>
                <Button
                  title="Remove from Board"
                  danger
                  secondary
                  loading={deletingId === n.id}
                  onPress={() => void handleDelete(n)}
                  style={{ minHeight: 38, paddingHorizontal: 14 }}
                />
              </Row>
            </Card>
          ))}
        </View>
      )}
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
  multilineInput: {
    minHeight: 130,
    textAlignVertical: "top",
  },
});
