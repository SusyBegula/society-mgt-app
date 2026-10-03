import { useState } from "react";
import { Screen, Header, Card, Txt, Chips, ErrorState, Button } from "../../src/components/ui";
import { Input, Action } from "../../src/components/office";
import { useApi } from "../../src/lib/api";
import { shareFile } from "../../src/lib/files";
export default function PrivacyDesk() {
  const query=useApi<any[]>("/admin/privacy");const [error,setError]=useState<Error|null>(null);
  return <Screen><Header title="Privacy requests and export"/><ErrorState error={query.error||error} retry={query.refetch}/>
    <Button title="Export society archive" secondary onPress={()=>{void shareFile("/admin/export.zip","society-export.zip").catch(setError);}}/>
    <Txt muted>The archive contains private society records and stored documents. Store it securely and share only with authorised people.</Txt>
    {query.data?.map(r=><RequestCard key={r.id} row={r}/>)}</Screen>;
}
function RequestCard({row:r}:{row:any}) {
  const [status,setStatus]=useState("In Progress");const [response,setResponse]=useState("");
  return <Card><Txt weight="bold">{r.kind} · {r.status}</Txt><Txt>{r.details}</Txt><Txt>{r.response}</Txt>
    {!["Completed","Declined"].includes(r.status)&&<><Chips options={["In Progress","Completed","Declined"]} value={status} onChange={setStatus}/>
      <Input label="Actions taken and response to resident" value={response} onChange={setResponse} multiline/>
      <Action title="Send response" path={`/admin/privacy/${r.id}`} method="PATCH" body={{status,response}}/></>}
  </Card>;
}
