import { useState } from "react";
import { Screen, Header, Card, Txt, Chips, ErrorState } from "./ui";
import { Input, Action, FormCard } from "./office";
import { useApi } from "../lib/api";
import { money } from "../lib/format";

export function RefundsView({office=false}:{office?:boolean}) {
  const base=office?"/admin/finance/refunds":"/refunds";
  const query=useApi<any[]>(base);
  const payments=useApi<any>(office?"/admin/finance/refundable-payments":"/payments");
  const list=(office?payments.data:payments.data?.items)?.filter((p:any)=>["Paid","Review Required"].includes(p.status)) ?? [];
  const [selected,setSelected]=useState("");const [amount,setAmount]=useState("");const [reason,setReason]=useState("");
  const label=(p:any)=>`${p.flat??p.period} · ${money(p.amount)} · ${p.reference??p.status}`;
  return <Screen><Header title={office?"Refund review":"Refund requests"}/><ErrorState error={query.error||payments.error} retry={query.refetch}/>
    <FormCard title="Request a refund"><Txt muted>A finance reviewer must approve the request. Refunding a maintenance payment reopens those dues; a separate credit adjustment is needed if the charge is waived.</Txt>
      <Chips options={list.map(label)} value={selected} onChange={setSelected}/><Input label="Refund amount (₹)" value={amount} onChange={setAmount} numeric/>
      <Input label="Reason" value={reason} onChange={setReason} multiline/>
      <Action title="Submit refund request" path={base} body={{payment_id:list.find((p:any)=>label(p)===selected)?.id??"",amount:Math.round(Number(amount)*100),reason}}/>
    </FormCard>{query.data?.map(r=><RefundCard key={r.id} row={r} office={office}/>)}</Screen>;
}
function RefundCard({row:r,office}:{row:any;office:boolean}) {
  const [reference,setReference]=useState("");
  return <Card><Txt weight="bold">{r.flat??"Refund"} · {money(r.amount)} · {r.status}</Txt><Txt>{r.reason}</Txt><Txt>{r.reference}</Txt>
    {office&&r.status==="Requested"&&<><Action title="Approve refund" path={`/admin/finance/refunds/${r.id}`} method="PATCH" body={{status:"Approved"}}/>
      <Action title="Decline refund" path={`/admin/finance/refunds/${r.id}`} method="PATCH" body={{status:"Declined"}} danger/></>}
    {office&&["Approved","Processing"].includes(r.status)&&<>
      {r.provider==="offline"&&<Input label="Reference of refund already made outside the app" value={reference} onChange={setReference}/>}
      <Action title={r.provider==="offline"?"Record completed refund":r.status==="Processing"?"Check / retry refund":"Send approved refund"}
        path={`/admin/finance/refunds/${r.id}/process`} body={{reference}}/>
    </>}
  </Card>;
}
