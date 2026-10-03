import { useState } from "react";
import { Screen, Header, Card, Txt, Chips, ErrorState, Button } from "../../src/components/ui";
import { Input, Action, FormCard } from "../../src/components/office";
import { useApi, request } from "../../src/lib/api";
import { uploadDocument } from "../../src/lib/files";

export default function Resources() {
  const query = useApi<any>("/admin/resources"); const setup = useApi<any>("/admin/setup");
  const [tab,setTab]=useState("Amenities"); const [name,setName]=useState(""); const [description,setDescription]=useState("");
  const [opens,setOpens]=useState("6");const [closes,setCloses]=useState("22");const [fee,setFee]=useState("0");
  const [phone,setPhone]=useState("");const [category,setCategory]=useState("General");const [flat,setFlat]=useState("");
  const [owners,setOwners]=useState("All residents");const [error,setError]=useState<Error|null>(null);const [uploading,setUploading]=useState(false);
  const units=setup.data?.units ?? [];
  return <Screen refresh={query.refetch}><Header title="Society resources" />
    <ErrorState error={query.error || error} retry={query.refetch}/>
    <Chips options={["Amenities","Contacts","Domestic help","Parking","Documents"]} value={tab} onChange={setTab}/>
    {tab === "Amenities" && <><FormCard title="Add amenity"><Input label="Name" value={name} onChange={setName}/>
      <Input label="Description and rules" value={description} onChange={setDescription} multiline/>
      <Input label="Opens (hour 0–23)" value={opens} onChange={setOpens} numeric/><Input label="Closes (hour 1–24)" value={closes} onChange={setCloses} numeric/>
      <Input label="Booking fee (₹, collected at office)" value={fee} onChange={setFee} numeric/>
      <Action title="Add amenity" path="/admin/resources/amenities" body={{name,description,opens:Number(opens),closes:Number(closes),fee:Math.round(Number(fee)*100)}}/>
    </FormCard>{query.data?.amenities.map((a:any)=><Card key={a.id}><Txt>{a.name} · {a.opens}:00–{a.closes}:00</Txt><Txt>{a.description}</Txt></Card>)}</>}
    {tab === "Contacts" && <><FormCard title="Add society contact"><Input label="Name" value={name} onChange={setName}/><Input label="Phone" value={phone} onChange={setPhone}/><Input label="Category" value={category} onChange={setCategory}/>
      <Action title="Add contact" path="/admin/resources/contacts" body={{name,phone,category}}/></FormCard>
      {query.data?.contacts.map((c:any)=><Card key={c.id}><Txt>{c.name} · {c.phone} · {c.category}</Txt><Action title="Remove contact" path={`/admin/resources/contacts/${c.id}`} method="DELETE" danger/></Card>)}</>}
    {tab === "Domestic help" && <><FormCard title="Register domestic help"><Input label="Name" value={name} onChange={setName}/><Input label="Work (e.g. Cook, Driver)" value={category} onChange={setCategory}/>
      <Chips options={units.map((u:any)=>`${u.building}/${u.number}`)} value={flat} onChange={setFlat}/>
      <Action title="Add household assignment" path="/admin/resources/help" body={{name,kind:category,unit_id:units.find((u:any)=>`${u.building}/${u.number}`===flat)?.id ?? ""}}/></FormCard>
      {query.data?.help.map((h:any)=><Card key={h.id}><Txt>{h.name} · {h.kind} · {h.status}</Txt></Card>)}</>}
    {tab === "Parking" && query.data?.vehicles.map((v:any)=><ParkingCard key={v.id} row={v}/>)}
    {tab === "Documents" && <><FormCard title="Publish a society document"><Input label="Document title" value={name} onChange={setName}/><Input label="Category" value={category} onChange={setCategory}/>
      <Chips options={["All residents","Owners only"]} value={owners} onChange={setOwners}/>
      <Button title="Choose and publish document" loading={uploading} onPress={()=>{setUploading(true);setError(null);
        void uploadDocument(name,category,owners==="Owners only").then(()=>query.refetch()).catch(setError).finally(()=>setUploading(false));}}/>
    </FormCard>{query.data?.documents.map((d:any)=><Card key={d.id}><Txt>{d.title} · {d.owners_only?"Owners only":"All residents"}</Txt></Card>)}</>}
  </Screen>;
}
function ParkingCard({row}:{row:any}) {
  const [slot,setSlot]=useState(row.parking_slot);
  return <Card><Txt weight="bold">{row.registration}</Txt><Input label="Allocated parking slot" value={slot} onChange={setSlot}/>
    <Action title="Assign slot" path={`/admin/resources/parking/${row.id}`} method="PUT" body={{slot}}/></Card>;
}
