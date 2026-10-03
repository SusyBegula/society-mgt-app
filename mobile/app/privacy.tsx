import { useState } from "react";
import { Screen, Header, Card, Txt, Chips, ErrorState } from "../src/components/ui";
import { Input, Action, FormCard } from "../src/components/office";
import { useApi } from "../src/lib/api";
export default function PrivacyRequests() {
  const query=useApi<any[]>("/privacy/requests");const [kind,setKind]=useState("Correction");const [details,setDetails]=useState("");
  return <Screen><Header title="Privacy and data requests"/><ErrorState error={query.error} retry={query.refetch}/>
    <FormCard title="Contact your society about your data"><Chips options={["Correction","Access","Deletion","Grievance"]} value={kind} onChange={setKind}/>
      <Input label="Describe your request" value={details} onChange={setDetails} multiline/>
      <Txt muted>The society reviews your request and explains any records it needs to retain. Submitting a deletion request does not immediately delete records.</Txt>
      <Action title="Submit request" path="/privacy/requests" body={{kind,details}}/></FormCard>
    {query.data?.map(r=><Card key={r.id}><Txt weight="bold">{r.kind} · {r.status}</Txt><Txt>{r.details}</Txt><Txt>{r.response}</Txt></Card>)}
  </Screen>;
}
