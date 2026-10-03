import { useState } from "react";
import { View, TextInput, Alert, StyleSheet } from "react-native";
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
  DetailRow,
  Divider,
} from "../../src/components/ui";
import { request, ApiError } from "../../src/lib/api";
import { date, time } from "../../src/lib/format";
import { colors as c, fonts } from "../../src/theme";
import type { VerifiedPass } from "../../src/types/api";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function VerifyPassScreen() {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [token, setToken] = useState("");
  const [isQrMode, setIsQrMode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pass, setPass] = useState<VerifiedPass | null>(null);
  const [checkInDone, setCheckInDone] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);

  const handleVerify = async (scannedToken?: string) => {
    setErrorMsg(null);
    setPass(null);
    setCheckInDone(false);

    const payload: { pin?: string; token?: string } = {};
    if (scannedToken) {
      payload.token = scannedToken;
    } else if (isQrMode) {
      if (!token.trim()) {
        setErrorMsg("Please enter or paste the QR Token.");
        return;
      }
      payload.token = token.trim();
    } else {
      if (!/^\d{6}$/.test(pin.trim())) {
        setErrorMsg("Please enter the 6-digit visitor PIN.");
        return;
      }
      payload.pin = pin.trim();
    }

    try {
      setVerifying(true);
      const result = await request<VerifiedPass>("/guard/verify-pass", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPass(result);
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err?.message || "Invalid pass. Please verify the code.";
      setErrorMsg(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleCheckIn = async () => {
    if (!pass) return;
    try {
      setCheckingIn(true);
      await request("/guard/visitors/check-in", {
        method: "POST",
        body: JSON.stringify({ invitation_id: pass.invitation_id }),
      });
      await queryClient.invalidateQueries({ queryKey: ["/guard/visitors/active"] });
      setCheckInDone(true);
    } catch (err: any) {
      Alert.alert("Check-in Failed", err?.message || "Could not complete check-in.");
    } finally {
      setCheckingIn(false);
    }
  };

  const resetForm = () => {
    setPin("");
    setToken("");
    setPass(null);
    setErrorMsg(null);
    setCheckInDone(false);
  };

  return (
    <Screen>
      <Header
        title="Verify Visitor Pass"
        subtitle="6-digit PIN or QR pass authentication"
      />

      {/* Input Entry Box */}
      {!checkInDone && <Button title={scanning ? "Close camera" : "Scan visitor QR pass"} secondary onPress={() => {
        if (scanning) {setScanning(false); return;}
        if (permission?.granted) setScanning(true);
        else void requestPermission().then(result => {
          if (result.granted) setScanning(true);
          else setErrorMsg("Camera permission is needed to scan. You can still enter the PIN.");
        });
      }} />}
      {scanning && <CameraView style={{height:280,borderRadius:16}} barcodeScannerSettings={{barcodeTypes:["qr"]}}
        onBarcodeScanned={verifying ? undefined : result => {setScanning(false);void handleVerify(result.data);}} />}
      {!checkInDone && (
        <Card style={{ gap: 14 }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Txt weight="bold" style={{ fontSize: 15 }}>
              {isQrMode ? "Enter QR Token" : "Enter 6-Digit Gate PIN"}
            </Txt>
            <Button
              title={isQrMode ? "Use 6-Digit PIN" : "Use QR Token"}
              secondary
              onPress={() => {
                setIsQrMode(!isQrMode);
                setErrorMsg(null);
                setPass(null);
              }}
              style={{ minHeight: 34, paddingHorizontal: 10 }}
            />
          </Row>

          {isQrMode ? (
            <TextInput
              value={token}
              onChangeText={(text) => {
                setToken(text);
                setErrorMsg(null);
              }}
              placeholder="Paste pass QR code token"
              placeholderTextColor="#9BA69F"
              autoCapitalize="none"
              style={styles.textInput}
            />
          ) : (
            <TextInput
              value={pin}
              onChangeText={(text) => {
                setPin(text);
                setErrorMsg(null);
              }}
              placeholder="e.g. 849201"
              placeholderTextColor="#9BA69F"
              keyboardType="number-pad"
              maxLength={6}
              style={[styles.textInput, styles.pinInput]}
            />
          )}

          {errorMsg && (
            <Row style={{ alignItems: "center", gap: 6, backgroundColor: c.redBg, padding: 10, borderRadius: 10 }}>
              <Icon name="alert-circle-outline" color={c.red} size={18} />
              <Txt style={{ color: c.red, fontSize: 13, flex: 1 }}>{errorMsg}</Txt>
            </Row>
          )}

          <Button
            title="Verify Pass"
            loading={verifying}
            onPress={() => void handleVerify()}
          />
        </Card>
      )}

      {/* Verified Pass Details Card */}
      {pass && !checkInDone && (
        <Card style={{ backgroundColor: "#F1F8E9", borderColor: "#C8E6C9", gap: 12 }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Row style={{ alignItems: "center", gap: 6 }}>
              <Icon name="shield-checkmark" color="#2E7D32" size={22} />
              <Txt weight="bold" style={{ fontSize: 16, color: "#2E7D32" }}>
                Valid Gate Pass
              </Txt>
            </Row>
            <Badge status="Allowed" />
          </Row>

          <Divider />

          <DetailRow label="Visitor Name" value={pass.visitor_name} />
          <DetailRow label="Visitor Phone" value={pass.visitor_phone} />
          <DetailRow
            label="Destination"
            value={`${pass.tower} · Flat ${pass.flat}`}
          />
          <DetailRow label="Host (Resident)" value={pass.host_name} />
          <DetailRow
            label="Pass Validity"
            value={`${date(pass.valid_from)} (${time(pass.valid_from)} - ${time(pass.valid_until)})`}
          />
          {pass.notes ? (
            <DetailRow label="Visit Notes" value={pass.notes} />
          ) : null}

          <View style={{ gap: 8, marginTop: 10 }}>
            <Button
              title="Allow Entry & Check In"
              loading={checkingIn}
              onPress={() => void handleCheckIn()}
              style={{ backgroundColor: "#2E7D32" }}
            />
            <Button
              title="Cancel"
              secondary
              onPress={resetForm}
              disabled={checkingIn}
            />
          </View>
        </Card>
      )}

      {/* Check In Success Confirmation Card */}
      {checkInDone && (
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 26, backgroundColor: "#E8F5E9" }}>
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
            Entry Granted & Checked In
          </Txt>

          <Txt muted style={{ textAlign: "center", maxWidth: 280, fontSize: 13 }}>
            {pass?.visitor_name} is now marked inside. The resident ({pass?.host_name}, {pass?.tower} - {pass?.flat}) has been notified.
          </Txt>

          <View style={{ width: "100%", gap: 10, marginTop: 12 }}>
            <Button
              title="Verify Another Pass"
              onPress={resetForm}
            />
            <Button
              title="Return to Gate Dashboard"
              secondary
              onPress={() => router.replace("/guard" as never)}
            />
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  textInput: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: c.ink,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 13,
    padding: 16,
    minHeight: 54,
  },
  pinInput: {
    fontFamily: fonts.bold,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
  },
});
