import { useState } from "react";
import { router } from "expo-router";
import { Screen, Header, Chips, Txt, Card, Button } from "../src/components/ui";
import { Input, Action, FormCard } from "../src/components/office";
import { useApi } from "../src/lib/api";

export default function Onboarding() {
  const [tab, setTab] = useState("Join a society");
  const [name, setName] = useState(""); const [address, setAddress] = useState("");
  const [code, setCode] = useState(""); const [building, setBuilding] = useState("");
  const [flat, setFlat] = useState(""); const [role, setRole] = useState("Owner");
  const [note, setNote] = useState("");
  const requests = useApi<{id: string; role: string; status: string}[]>("/onboarding/requests");
  return <Screen><Header title="Set up your society access" />
    <Chips options={["Join a society", "Create a society"]} value={tab} onChange={setTab} />
    {tab === "Create a society" ? <FormCard title="Register your society">
      <Txt muted>Create this only if you are authorised to administer the society. Residents should use an invitation code.</Txt>
      <Input label="Society name" value={name} onChange={setName} />
      <Input label="Address" value={address} onChange={setAddress} multiline />
      <Action title="Create society" path="/onboarding/societies" body={{name, address}}
        after={() => router.replace("/properties?switch=true")} />
    </FormCard> : <FormCard title="Request verified access">
      <Input label="Invitation code from your office" value={code} onChange={setCode} />
      <Input label="Building / tower" value={building} onChange={setBuilding} />
      <Input label="Flat number" value={flat} onChange={setFlat} />
      <Chips options={["Owner", "Tenant"]} value={role} onChange={setRole} />
      <Input label="Note for the office (optional)" value={note} onChange={setNote} />
      <Action title="Request access" path="/onboarding/join" body={{code, building, flat, role, note}} />
      <Txt muted>Your office verifies occupancy before granting access.</Txt>
    </FormCard>}
    {requests.data?.map(r => <Card key={r.id}><Txt>{r.role} access · {r.status}</Txt></Card>)}
    <Button title="Check my properties" secondary onPress={() => router.replace("/properties?switch=true")} />
  </Screen>;
}
