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
import { date, money, localDay } from "../../src/lib/format";
import { colors as c, fonts } from "../../src/theme";
import type { FinanceSummary, DefaulterUnit, DefaulterBill } from "../../src/types/api";

const PAYMENT_METHODS = ["Bank Transfer", "UPI", "Cheque", "Cash"] as const;

export default function AdminFinanceScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"defaulters" | "generate">("defaulters");

  // Queries
  const summaryQuery = useApi<FinanceSummary>("/admin/finance/summary");
  const defaultersQuery = useApi<DefaulterUnit[]>("/admin/finance/defaulters");

  const summary = summaryQuery.data;
  const defaulters = defaultersQuery.data || [];

  // Reminder state
  const [remindingId, setRemindingId] = useState<string | null>(null);

  // Bulk Generator Form State
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const defaultPeriod = nextMonth.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const [period, setPeriod] = useState(defaultPeriod);
  const [dueDateStr, setDueDateStr] = useState(localDay(30));
  const [baseAmount, setBaseAmount] = useState("3500");
  const [sinkingFund, setSinkingFund] = useState("500");
  const [servicesFee, setServicesFee] = useState("500");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<{ count: number; period: string; total: number } | null>(null);

  // Offline Payment Modal State
  const [paymentUnit, setPaymentUnit] = useState<DefaulterUnit | null>(null);
  const [selectedBill, setSelectedBill] = useState<DefaulterBill | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"Bank Transfer" | "UPI" | "Cheque" | "Cash">("Bank Transfer");
  const [payReference, setPayReference] = useState("");
  const [recordingPay, setRecordingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const handleSendReminder = async (unit: DefaulterUnit) => {
    try {
      setRemindingId(unit.unit_id);
      await request("/admin/finance/reminder", {
        method: "POST",
        body: JSON.stringify({ unit_id: unit.unit_id }),
      });
      Alert.alert(
        "Reminder Sent",
        `Payment reminder delivered to ${unit.tower} - ${unit.flat} residents via push notification.`
      );
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not send reminder.");
    } finally {
      setRemindingId(null);
    }
  };

  const handleGenerateBulk = async () => {
    setGenerateError(null);
    const base = parseInt(baseAmount, 10);
    const sinking = parseInt(sinkingFund, 10) || 0;
    const services = parseInt(servicesFee, 10) || 0;

    if (!period.trim()) {
      setGenerateError("Please enter a billing period label (e.g. November 2026).");
      return;
    }
    if (isNaN(base) || base <= 0) {
      setGenerateError("Please specify a valid base maintenance charge.");
      return;
    }

    const items = [
      { label: "Base Maintenance", amount: base * 100 },
    ];
    if (sinking > 0) items.push({ label: "Sinking Fund", amount: sinking * 100 });
    if (services > 0) items.push({ label: "Common Services & Security", amount: services * 100 });

    try {
      setGenerating(true);
      const res = await request<{ generated_count: number; period: string; total_amount: number }>(
        "/admin/finance/bills/bulk",
        {
          method: "POST",
          body: JSON.stringify({
            period: period.trim(),
            due_date: new Date(dueDateStr + "T23:59:59").toISOString(),
            items,
          }),
        }
      );

      await Promise.all([summaryQuery.refetch(), defaultersQuery.refetch()]);
      setGenerateResult({
        count: res.generated_count,
        period: res.period,
        total: res.total_amount,
      });
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Failed to generate bulk bills.";
      setGenerateError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const openOfflinePaymentModal = (unit: DefaulterUnit) => {
    setPaymentUnit(unit);
    const bill = unit.bills[0] || null;
    setSelectedBill(bill);
    setPayAmount(bill ? String(bill.outstanding / 100) : "");
    setPayMethod("Bank Transfer");
    setPayReference("");
    setPayError(null);
  };

  const handleRecordPayment = async () => {
    if (!selectedBill || !paymentUnit) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setPayError("Enter a valid payment amount.");
      return;
    }

    try {
      setRecordingPay(true);
      setPayError(null);
      await request("/admin/finance/payments/record-offline", {
        method: "POST",
        body: JSON.stringify({
          bill_id: selectedBill.id,
          amount: Math.round(amt * 100),
          method: payMethod,
          reference: payReference.trim(),
        }),
      });

      await Promise.all([summaryQuery.refetch(), defaultersQuery.refetch()]);
      setPaymentUnit(null);
      Alert.alert(
        "Payment Recorded",
        `Receipt of ₹${amt.toLocaleString("en-IN")} recorded for ${paymentUnit.tower} - ${paymentUnit.flat}. Resident notified.`
      );
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Could not record payment.";
      setPayError(msg);
    } finally {
      setRecordingPay(false);
    }
  };

  return (
    <Screen
      refresh={() => {
        void Promise.all([summaryQuery.refetch(), defaultersQuery.refetch()]);
      }}
    >
      <Header
        title="Treasury & Finance"
        subtitle="Collections, bulk billing & resident dues"
      />

      {/* KPI Stats Grid */}
      {summaryQuery.isLoading && <Loading />}
      <ErrorState error={summaryQuery.error} retry={summaryQuery.refetch} />

      {summary && (
        <View style={{ gap: 10, marginBottom: 8 }}>
          <Row style={{ gap: 10 }}>
            {/* Total Collected */}
            <Card style={{ flex: 1, backgroundColor: "#E8F5E9", borderColor: "#C8E6C9" }}>
              <Txt muted style={{ fontSize: 11, color: "#2E7D32" }}>
                Total Collections
              </Txt>
              <Txt weight="extra" style={{ fontSize: 20, color: "#1B5E20", marginTop: 2 }}>
                {money(summary.total_collected)}
              </Txt>
              <Txt style={{ fontSize: 10, color: "#2E7D32", marginTop: 2 }}>
                Paid to date
              </Txt>
            </Card>

            {/* Total Pending / Dues */}
            <Card style={{ flex: 1, backgroundColor: "#FFEBEE", borderColor: "#FFCDD2" }}>
              <Txt muted style={{ fontSize: 11, color: "#C62828" }}>
                Pending Dues
              </Txt>
              <Txt weight="extra" style={{ fontSize: 20, color: "#C62828", marginTop: 2 }}>
                {money(summary.total_outstanding)}
              </Txt>
              <Txt style={{ fontSize: 10, color: "#C62828", marginTop: 2 }}>
                Across {summary.defaulters_count} flats
              </Txt>
            </Card>
          </Row>

          <Row style={{ gap: 10 }}>
            {/* Total Billed */}
            <Card style={{ flex: 1 }}>
              <Txt muted style={{ fontSize: 11 }}>
                Total Billed
              </Txt>
              <Txt weight="bold" style={{ fontSize: 17, marginTop: 2 }}>
                {money(summary.total_billed)}
              </Txt>
            </Card>

            {/* Defaulter Flats */}
            <Card style={{ flex: 1 }}>
              <Txt muted style={{ fontSize: 11 }}>
                Defaulter Units
              </Txt>
              <Txt weight="bold" style={{ fontSize: 17, marginTop: 2, color: summary.defaulters_count > 0 ? c.red : c.primary }}>
                {summary.defaulters_count} Flats
              </Txt>
            </Card>
          </Row>
        </View>
      )}

      {/* Tabs */}
      <Row style={{ gap: 10 }}>
        <Pressable
          onPress={() => setActiveTab("defaulters")}
          style={[
            styles.tabButton,
            activeTab === "defaulters" && styles.tabButtonActive,
          ]}
        >
          <Txt
            weight="bold"
            style={{
              color: activeTab === "defaulters" ? "#fff" : c.ink,
              fontSize: 13,
            }}
          >
            Defaulters & Dues ({defaulters.length})
          </Txt>
        </Pressable>

        <Pressable
          onPress={() => {
            setActiveTab("generate");
            setGenerateResult(null);
          }}
          style={[
            styles.tabButton,
            activeTab === "generate" && styles.tabButtonActive,
          ]}
        >
          <Txt
            weight="bold"
            style={{
              color: activeTab === "generate" ? "#fff" : c.ink,
              fontSize: 13,
            }}
          >
            + Bulk Bill Generator
          </Txt>
        </Pressable>
      </Row>

      {/* TAB 1: DEFAULTERS & PENDING DUES */}
      {activeTab === "defaulters" && (
        <View style={{ gap: 12 }}>
          {defaultersQuery.isLoading && <Loading />}
          <ErrorState error={defaultersQuery.error} retry={defaultersQuery.refetch} />

          {defaulters.length === 0 && !defaultersQuery.isLoading && (
            <Card style={{ alignItems: "center", paddingVertical: 32 }}>
              <Empty
                icon="checkmark-circle-outline"
                title="Zero Pending Dues!"
                description="All flats have cleared their maintenance charges."
              />
            </Card>
          )}

          {defaulters.map((u) => (
            <Card key={u.unit_id} style={{ gap: 10 }}>
              <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Row style={{ alignItems: "center", gap: 8 }}>
                    <Txt weight="bold" style={{ fontSize: 16 }}>
                      {u.tower} · Flat {u.flat}
                    </Txt>
                    <Badge status="Overdue" />
                  </Row>
                  <Txt muted style={{ fontSize: 13, marginTop: 2 }}>
                    {u.resident_name} {u.resident_phone ? `(${u.resident_phone})` : ""}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt weight="extra" style={{ fontSize: 18, color: c.red }}>
                    {money(u.total_outstanding)}
                  </Txt>
                  <Txt muted style={{ fontSize: 11 }}>
                    {u.bills_count} unpaid {u.bills_count === 1 ? "bill" : "bills"}
                  </Txt>
                </View>
              </Row>

              <Divider />

              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Txt muted style={{ fontSize: 12 }}>
                  Earliest Due: {date(u.oldest_due_date)}
                </Txt>
                <Row style={{ gap: 8 }}>
                  <Button
                    title="Reminder"
                    secondary
                    loading={remindingId === u.unit_id}
                    onPress={() => void handleSendReminder(u)}
                    style={{ minHeight: 36, paddingHorizontal: 10 }}
                  />
                  <Button
                    title="Record Payment"
                    onPress={() => openOfflinePaymentModal(u)}
                    style={{ minHeight: 36, paddingHorizontal: 12 }}
                  />
                </Row>
              </Row>
            </Card>
          ))}
        </View>
      )}

      {/* TAB 2: BULK BILL GENERATOR */}
      {activeTab === "generate" && (
        <View style={{ gap: 14 }}>
          {generateResult && (
            <Card style={{ backgroundColor: "#E8F5E9", borderColor: "#C8E6C9", alignItems: "center", gap: 10, paddingVertical: 24 }}>
              <Icon name="checkmark-circle" color="#2E7D32" size={36} />
              <Txt weight="extra" style={{ fontSize: 18, color: "#1B5E20" }}>
                Bills Dispatched!
              </Txt>
              <Txt style={{ color: "#2E7D32", fontSize: 13, textAlign: "center", maxWidth: 280 }}>
                Successfully published {generateResult.period} maintenance bills of {money(generateResult.total)} for {generateResult.count} society flats. Push notifications sent!
              </Txt>
              <Row style={{ gap: 10, width: "100%", marginTop: 8 }}>
                <Button
                  title="Generate Another"
                  onPress={() => setGenerateResult(null)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="View Dues List"
                  secondary
                  onPress={() => setActiveTab("defaulters")}
                  style={{ flex: 1 }}
                />
              </Row>
            </Card>
          )}

          {!generateResult && (
            <Card style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Billing Period Label *
                </Txt>
                <TextInput
                  value={period}
                  onChangeText={(text) => {
                    setPeriod(text);
                    setGenerateError(null);
                  }}
                  placeholder="e.g. November 2026 or Q4 2026"
                  placeholderTextColor="#9BA69F"
                  style={styles.textInput}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Payment Due Date (YYYY-MM-DD) *
                </Txt>
                <TextInput
                  value={dueDateStr}
                  onChangeText={setDueDateStr}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9BA69F"
                  style={styles.textInput}
                />
              </View>

              <Divider />

              <Txt weight="bold" style={{ fontSize: 15 }}>
                Itemized Charges Per Flat
              </Txt>

              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Base Maintenance (₹) *
                </Txt>
                <TextInput
                  value={baseAmount}
                  onChangeText={setBaseAmount}
                  placeholder="3500"
                  placeholderTextColor="#9BA69F"
                  keyboardType="numeric"
                  style={styles.textInput}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Sinking Fund Contribution (₹)
                </Txt>
                <TextInput
                  value={sinkingFund}
                  onChangeText={setSinkingFund}
                  placeholder="500"
                  placeholderTextColor="#9BA69F"
                  keyboardType="numeric"
                  style={styles.textInput}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Common Services & Security (₹)
                </Txt>
                <TextInput
                  value={servicesFee}
                  onChangeText={setServicesFee}
                  placeholder="500"
                  placeholderTextColor="#9BA69F"
                  keyboardType="numeric"
                  style={styles.textInput}
                />
              </View>

              {/* Total Calculation Preview */}
              <Row
                style={{
                  backgroundColor: "#F5F5F5",
                  padding: 14,
                  borderRadius: 12,
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Txt weight="bold" style={{ fontSize: 15 }}>
                  Total Bill per Flat:
                </Txt>
                <Txt weight="extra" style={{ fontSize: 20, color: c.primary }}>
                  ₹
                  {(
                    (parseInt(baseAmount, 10) || 0) +
                    (parseInt(sinkingFund, 10) || 0) +
                    (parseInt(servicesFee, 10) || 0)
                  ).toLocaleString("en-IN")}
                </Txt>
              </Row>

              {generateError && (
                <Row style={{ alignItems: "center", gap: 6, backgroundColor: c.redBg, padding: 10, borderRadius: 10 }}>
                  <Icon name="alert-circle-outline" color={c.red} size={18} />
                  <Txt style={{ color: c.red, fontSize: 13, flex: 1 }}>{generateError}</Txt>
                </Row>
              )}

              <Button
                title="Publish Bills to All Flats"
                loading={generating}
                onPress={() => void handleGenerateBulk()}
                style={{ marginTop: 6 }}
              />
            </Card>
          )}
        </View>
      )}

      {/* OFFLINE PAYMENT RECORDING MODAL */}
      <Modal
        visible={!!paymentUnit}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentUnit(null)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            <Card style={styles.modalContent}>
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Txt weight="bold" style={{ fontSize: 18 }}>
                  Record Offline Payment
                </Txt>
                <Pressable onPress={() => setPaymentUnit(null)} style={{ padding: 4 }}>
                  <Icon name="close" size={22} color={c.muted} />
                </Pressable>
              </Row>

              <Txt muted style={{ fontSize: 13 }}>
                Flat: {paymentUnit?.tower} - {paymentUnit?.flat} ({paymentUnit?.resident_name})
              </Txt>

              <Divider />

              {/* Bill selection if multiple */}
              {paymentUnit && paymentUnit.bills.length > 1 && (
                <View style={{ gap: 6 }}>
                  <Txt weight="semibold" style={{ fontSize: 12 }}>
                    Select Bill to Clear:
                  </Txt>
                  {paymentUnit.bills.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => {
                        setSelectedBill(b);
                        setPayAmount(String(b.outstanding / 100));
                      }}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: selectedBill?.id === b.id ? c.primary : c.line,
                        backgroundColor: selectedBill?.id === b.id ? "#E8F5E9" : "#fff",
                      }}
                    >
                      <Row style={{ justifyContent: "space-between" }}>
                        <Txt weight="bold" style={{ fontSize: 13 }}>
                          {b.period}
                        </Txt>
                        <Txt weight="bold" style={{ color: c.red }}>
                          Due: {money(b.outstanding)}
                        </Txt>
                      </Row>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Amount Input */}
              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Amount Paid (₹) *
                </Txt>
                <TextInput
                  value={payAmount}
                  onChangeText={(text) => {
                    setPayAmount(text);
                    setPayError(null);
                  }}
                  keyboardType="numeric"
                  placeholder="e.g. 4500"
                  placeholderTextColor="#9BA69F"
                  style={styles.textInput}
                />
              </View>

              {/* Payment Method Chips */}
              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Payment Method *
                </Txt>
                <Chips
                  options={[...PAYMENT_METHODS]}
                  value={payMethod}
                  onChange={(val) => setPayMethod(val as any)}
                />
              </View>

              {/* Reference / Cheque No */}
              <View style={{ gap: 6 }}>
                <Txt weight="semibold" style={{ fontSize: 12 }}>
                  Transaction / Cheque / UTR Reference
                </Txt>
                <TextInput
                  value={payReference}
                  onChangeText={setPayReference}
                  placeholder="e.g. CHQ-48201 or IMPS-938204"
                  placeholderTextColor="#9BA69F"
                  style={styles.textInput}
                />
              </View>

              {payError && (
                <Row style={{ alignItems: "center", gap: 6, backgroundColor: c.redBg, padding: 10, borderRadius: 10 }}>
                  <Icon name="alert-circle-outline" color={c.red} size={18} />
                  <Txt style={{ color: c.red, fontSize: 13, flex: 1 }}>{payError}</Txt>
                </Row>
              )}

              <Button
                title="Confirm & Issue Receipt"
                loading={recordingPay}
                onPress={() => void handleRecordPayment()}
              />
            </Card>
          </ScrollView>
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
