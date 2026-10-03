import { useState } from "react";
import { Screen, Header, Card, Txt, Chips, ErrorState } from "../src/components/ui";
import { Input, Action } from "../src/components/office";
import { useApi } from "../src/lib/api";
export default function Platform() {
  const query=useApi<any[]>("/platform/societies");
  return <Screen><Header title="Platform societies"/><ErrorState error={query.error} retry={query.refetch}/>
    <Txt>Manage society subscriptions. Maintenance payments belong to each society's own merchant account.</Txt>
    {query.data?.map(s=><Subscription key={s.id} society={s}/>)}</Screen>;
}
function Subscription({society:s}:{society:any}) {
  const [plan,setPlan]=useState(s.subscription?.plan??"Pilot");const [status,setStatus]=useState(s.subscription?.status??"Trial");
  const [amount,setAmount]=useState(String((s.subscription?.amount??0)/100));const [renewal,setRenewal]=useState(s.subscription?.renews_at?.slice(0,10)??"");
  return <Card><Txt weight="bold">{s.name}</Txt><Input label="Plan" value={plan} onChange={setPlan}/>
    <Chips options={["Trial","Active","Past Due","Cancelled"]} value={status} onChange={setStatus}/><Input label="Subscription amount (₹)" value={amount} onChange={setAmount} numeric/>
    <Input label="Renewal date (YYYY-MM-DD, optional)" value={renewal} onChange={setRenewal}/>
    <Action title="Save subscription" path={`/platform/societies/${s.id}/subscription`} method="PUT" body={{plan,status,amount:Math.round(Number(amount)*100),renews_at:renewal?renewal+"T23:59:59+05:30":null}}/>
  </Card>;
}
