import { useState } from "react";
import { TextInput, View, Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Txt, Chips } from "./ui";
import { request } from "../lib/api";
import { colors, fonts } from "../theme";
import { registerPush } from "../lib/push";

export function EnableAlerts() {
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [enabled,setEnabled]=useState(false);
  if(Platform.OS==="web"||enabled)return null;
  return <View><Button title="Enable visitor and society alerts" secondary loading={busy} onPress={()=>{
    setBusy(true);void registerPush().then(()=>setEnabled(true)).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));
  }}/>{!!message&&<Txt accessibilityRole="alert">{message}</Txt>}</View>;
}

export function Input({ label, value, onChange, multiline = false, numeric = false }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; numeric?: boolean;
}) {
  return <View style={{ gap: 6 }}><Txt weight="semibold">{label}</Txt><TextInput accessibilityLabel={label}
    value={value} onChangeText={onChange} multiline={multiline} keyboardType={numeric ? "decimal-pad" : "default"}
    autoCapitalize="none" style={{ backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1,
      borderRadius: 12, padding: 14, minHeight: multiline ? 120 : 50, color: colors.ink, fontFamily: fonts.medium }} /></View>;
}

export function Action({ title, path, method = "POST", body, after, danger = false }: {
  title: string; path: string; method?: string; body?: unknown; after?: (result: any) => void; danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  async function run() {
    setBusy(true); setMessage("");
    try {
      const result = await request<any>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      await client.invalidateQueries();
      after?.(result);
      setMessage("Saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save. Please try again."); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 6 }}><Button title={title} onPress={() => void run()} loading={busy} danger={danger} />
    {!!message && <Txt accessibilityRole="alert">{message}</Txt>}</View>;
}

export function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card style={{ gap: 14 }}><Txt weight="bold" style={{ fontSize: 18 }}>{title}</Txt>{children}</Card>;
}
