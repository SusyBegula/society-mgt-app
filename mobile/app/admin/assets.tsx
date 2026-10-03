import { useState } from "react";
import { Screen, Header, Card, Txt, Chips, ErrorState } from "../../src/components/ui";
import { Input, Action, FormCard } from "../../src/components/office";
import { useApi } from "../../src/lib/api";
export default function Assets() {
  const query=useApi<any[]>("/admin/assets");const [name,setName]=useState("");const [kind,setKind]=useState("Asset");
  const [quantity,setQuantity]=useState("1");const [notes,setNotes]=useState("");const [next,setNext]=useState("");
  return <Screen><Header title="Facilities and contracts"/><ErrorState error={query.error} retry={query.refetch}/>
    <FormCard title="Add a record"><Input label="Name" value={name} onChange={setName}/><Chips options={["Asset","Inventory","Contract"]} value={kind} onChange={setKind}/>
      <Input label="Quantity" value={quantity} onChange={setQuantity} numeric/><Input label="Details / vendor / contract terms" value={notes} onChange={setNotes} multiline/>
      <Input label="Next service / renewal date (YYYY-MM-DD, optional)" value={next} onChange={setNext}/>
      <Action title="Add record" path="/admin/assets" body={{name,kind,quantity:Number(quantity),notes,next_service_at:next?next+"T09:00:00+05:30":null}}/>
    </FormCard>{query.data?.map(a=><AssetCard key={a.id} row={a}/>)}</Screen>;
}
function AssetCard({row:a}:{row:any}) {
  const [next,setNext]=useState("");const [note,setNote]=useState("");
  return <Card><Txt weight="bold">{a.name} · {a.kind} · Quantity {a.quantity}</Txt><Txt>{a.notes}</Txt>
    <Txt>Next service: {a.next_service_at?new Date(a.next_service_at).toLocaleDateString():"Not set"}</Txt>
    <Input label="Service completed / work done" value={note} onChange={setNote}/><Input label="Next service date (YYYY-MM-DD)" value={next} onChange={setNext}/>
    <Action title="Record completed service" path={`/admin/assets/${a.id}/service`} body={{note,next_service_at:next+"T09:00:00+05:30"}}/>
  </Card>;
}
