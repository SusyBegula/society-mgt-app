import { useState } from "react";
import { Screen, Header, Card, Txt, Chips, ErrorState, Loading, Confirm } from "../../src/components/ui";
import { Input, Action, FormCard } from "../../src/components/office";
import { useApi, request } from "../../src/lib/api";

type Unit = {id: string; building: string; number: string; area_sqft: number};
type Setup = {society: {id: string; name: string; join_code: string; settings: Record<string, unknown>}; units: Unit[]};
export default function SocietySetup() {
  const setup = useApi<Setup>("/admin/setup");
  const pending = useApi<any[]>("/admin/setup/requests");
  const staff = useApi<any[]>("/admin/setup/staff");
  const [tab, setTab] = useState("Flats");
  const [building, setBuilding] = useState(""); const [number, setNumber] = useState("");
  const [area, setArea] = useState("0"); const [balance, setBalance] = useState("0");
  const [csv, setCsv] = useState("building,number,area_sqft,opening_balance\n");
  const [preview, setPreview] = useState<any>(null);
  const [unit, setUnit] = useState(""); const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91"); const [role, setRole] = useState("Owner");
  const [staffRole, setStaffRole] = useState("Guard");
  const [visitorAccess, setVisitorAccess] = useState("Yes");
  const [moving, setMoving] = useState<Unit | null>(null); const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const units = setup.data?.units ?? [];
  return <Screen refresh={() => {void setup.refetch(); void pending.refetch(); void staff.refetch();}}>
    <Header title="Society setup" subtitle={setup.data?.society.name} />
    {setup.isLoading && <Loading />}<ErrorState error={setup.error || error} retry={setup.refetch} />
    <Card><Txt weight="bold">Resident invitation code</Txt><Txt selectable>{setup.data?.society.join_code ?? "Generate a code below"}</Txt>
      <Txt muted>Share with residents. Every request still needs office verification.</Txt>
      <Action title="Generate a new invitation code" path="/admin/setup/rotate-code" />
    </Card>
    <Chips options={["Flats", "Import", "Residents", "Requests", "Staff"]} value={tab} onChange={setTab} />
    {tab === "Flats" && <>
      <FormCard title="Add a flat"><Input label="Building / tower" value={building} onChange={setBuilding} />
        <Input label="Flat number" value={number} onChange={setNumber} /><Input label="Area in square feet" value={area} onChange={setArea} numeric />
        <Input label="Opening dues (₹)" value={balance} onChange={setBalance} numeric />
        <Action title="Add flat" path="/admin/setup/units" body={{building, number, area_sqft: Number(area), opening_balance: Math.round(Number(balance)*100)}} />
      </FormCard>
      {units.map(u => <Card key={u.id}><Txt weight="bold">{u.building} / {u.number}</Txt><Txt>{u.area_sqft} sq ft</Txt>
        <Txt onPress={() => setMoving(u)} style={{color: "#B42318"}}>Move out tenants and family</Txt></Card>)}
    </>}
    {tab === "Import" && <FormCard title="Import flats from CSV">
      <Txt muted>Export a spreadsheet with the four headers below. Opening balances are in paise: ₹1,000 = 100000. Existing flats are rejected; the import is all-or-nothing.</Txt>
      <Input label="CSV content" value={csv} onChange={v => {setCsv(v); setPreview(null);}} multiline />
      <Action title="Preview import" path="/admin/setup/import" body={{csv, preview: true}} after={setPreview} />
      {preview && <><Txt>{preview.count} flats · opening dues ₹{preview.opening_balance / 100}</Txt>
        {preview.rows.map((r: any, i: number) => <Txt key={i}>{r.building} / {r.number} · {r.area_sqft} sq ft</Txt>)}
        <Action title={`Import ${preview.count} flats`} path="/admin/setup/import" body={{csv, preview: false}} after={() => setPreview(null)} /></>}
    </FormCard>}
    {tab === "Residents" && <FormCard title="Add a verified resident">
      <Txt muted>Verify the person's ownership or occupancy with your society's process before granting access.</Txt>
      <Chips options={units.map(u => `${u.building} / ${u.number}`)} value={unit} onChange={setUnit} />
      <Input label="Name" value={name} onChange={setName} /><Input label="Mobile (+91…)" value={phone} onChange={setPhone} />
      <Chips options={["Owner", "Tenant"]} value={role} onChange={setRole} />
      <Txt>Receives and approves visitors</Txt><Chips options={["Yes", "No"]} value={visitorAccess} onChange={setVisitorAccess} />
      <Action title="Grant resident access" path="/admin/setup/members" body={{unit_id: units.find(u => `${u.building} / ${u.number}` === unit)?.id ?? "", name, phone, role, receives_visitors: visitorAccess === "Yes"}} />
    </FormCard>}
    {tab === "Requests" && <><ErrorState error={pending.error} retry={pending.refetch} />
      {pending.data?.length === 0 && <Txt>No pending requests.</Txt>}
      {pending.data?.map(r => <Card key={r.id}><Txt weight="bold">{r.name} · {r.phone}</Txt><Txt>{r.building} / {r.flat} · {r.role}</Txt><Txt>{r.note}</Txt>
        <Action title="Approve verified resident" path={`/admin/setup/requests/${r.id}`} body={{decision: "Approved"}} />
        <Action title="Reject request" path={`/admin/setup/requests/${r.id}`} body={{decision: "Rejected"}} danger /></Card>)}
    </>}
    {tab === "Staff" && <><FormCard title="Staff and committee access">
      <Txt muted>Administrators grant access. Secretaries manage society operations; treasurers manage finances; guards manage gate operations.</Txt>
      <Input label="Name" value={name} onChange={setName} /><Input label="Mobile (+91…)" value={phone} onChange={setPhone} />
      <Chips options={["Guard", "Secretary", "Treasurer"]} value={staffRole} onChange={setStaffRole} />
      <Action title="Grant staff access" path="/admin/setup/staff" body={{name, phone, role: staffRole}} />
    </FormCard>{staff.data?.map(r => <Card key={r.id}><Txt>{r.name} · {r.role} · {r.active ? "Active" : "Inactive"}</Txt>
      {r.active && r.role !== "Admin" && <Action title="Revoke staff access" path={`/admin/setup/staff/${r.id}`} method="DELETE" danger />}</Card>)}</>}
    <Confirm visible={!!moving} title="Move out this household?" message={`Tenant and family access for ${moving?.building} / ${moving?.number} will be revoked. Owner access and financial records are retained.`}
      loading={busy} danger onCancel={() => setMoving(null)} onConfirm={() => {setBusy(true); setError(null);
        void request(`/admin/setup/units/${moving?.id}/move-out`, {method:"POST"}).then(() => setMoving(null)).catch(setError).finally(() => setBusy(false));}} />
  </Screen>;
}
