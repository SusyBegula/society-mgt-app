import { useState } from "react";
import { Linking } from "react-native";
import { Screen, Header, Card, Txt, Button, ErrorState, Badge } from "../../src/components/ui";
import { Input, Action } from "../../src/components/office";
import { useApi } from "../../src/lib/api";
import { date, time } from "../../src/lib/format";

export default function Emergencies() {
  const query = useApi<any[]>("/guard/emergencies", 5000);
  return <Screen refresh={query.refetch}><Header title="Emergency response desk" />
    <Txt>Call appropriate emergency services when needed. Acknowledging an alert tells residents that society staff have seen it.</Txt>
    <ErrorState error={query.error} retry={query.refetch} />
    {query.data?.length === 0 && <Txt>No open alerts.</Txt>}
    {query.data?.map(row => <AlertCard key={row.id} row={row} />)}
  </Screen>;
}
function AlertCard({ row }: {row: any}) {
  const [note, setNote] = useState("");
  return <Card><Txt weight="bold">{row.kind} · {row.building} / {row.flat}</Txt><Badge status={row.status} />
    <Txt>{row.resident} · {date(row.created_at)} {time(row.created_at)}</Txt><Txt>{row.response_note}</Txt>
    <Button title="Call resident" secondary onPress={() => void Linking.openURL(`tel:${row.phone}`)} />
    <Input label="Response / action taken" value={note} onChange={setNote} multiline />
    <Action title={row.status === "Open" ? "Acknowledge alert" : "Mark resolved"} path={`/guard/emergencies/${row.id}`}
      method="PATCH" body={{status: row.status === "Open" ? "Acknowledged" : "Resolved", note}} />
  </Card>;
}
