import { useEffect, useState } from "react";
import { Screen, Header, Txt, Card, ErrorState } from "../../src/components/ui";
import { Input, Action, FormCard } from "../../src/components/office";
import { useApi } from "../../src/lib/api";
export default function Policies() {
  const setup=useApi<any>("/admin/setup");const audit=useApi<any>("/admin/audit");
  const [form,setForm]=useState({office_phone:"",security_phone:"",privacy_policy:"",terms:"",grievance_email:"",visitor_retention_days:90,complaint_response_hours:48});
  useEffect(()=>{if(setup.data)setForm(f=>({...f,...setup.data.society.settings}));},[setup.data]);
  return <Screen><Header title="Policies and activity"/><ErrorState error={setup.error} retry={setup.refetch}/>
    <FormCard title="Society settings">
      {([['office_phone','Office phone (+91…)'],['security_phone','Security phone (+91…)'],['grievance_email','Grievance email'],['privacy_policy','Privacy policy'],['terms','Terms of use']] as const).map(([key,label])=><Input key={key} label={label} value={form[key]} onChange={v=>setForm({...form,[key]:v})} multiline={key==='privacy_policy'||key==='terms'}/>)}
      <Input label="Visitor data retention (days)" value={String(form.visitor_retention_days)} onChange={v=>setForm({...form,visitor_retention_days:Number(v)})} numeric/>
      <Input label="Complaint response target (hours)" value={String(form.complaint_response_hours)} onChange={v=>setForm({...form,complaint_response_hours:Number(v)})} numeric/>
      <Action title="Save society settings" path="/admin/setup/settings" method="PUT" body={form}/>
    </FormCard><Txt weight="bold">Recent administrative activity</Txt>
    <ErrorState error={audit.error} retry={audit.refetch}/>{audit.data?.items.map((a:any)=><Card key={a.id}><Txt>{a.action.replaceAll('.',' ')}</Txt><Txt>{new Date(a.created_at).toLocaleString()}</Txt></Card>)}
  </Screen>;
}
