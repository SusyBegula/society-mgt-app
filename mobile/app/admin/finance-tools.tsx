import { useEffect, useState } from "react";
import { Screen, Header, Card, Txt, Chips, ErrorState, Button } from "../../src/components/ui";
import { Input, Action, FormCard } from "../../src/components/office";
import { useApi } from "../../src/lib/api";
import { shareFile } from "../../src/lib/files";
import { money } from "../../src/lib/format";

export default function FinanceTools() {
  const [tab, setTab] = useState("Billing rules");
  const units = useApi<any[]>("/admin/finance/units");
  const rules = useApi<any[]>("/admin/finance/rules");
  const cheques = useApi<any[]>("/admin/finance/cheques");
  const vendors = useApi<any[]>("/admin/finance/vendors");
  const expenses = useApi<any[]>("/admin/finance/expenses");
  const bank = useApi<any[]>("/admin/finance/bank");
  const account = useApi<{configured: boolean; society_id: string}>("/admin/finance/payment-account");
  const [label, setLabel] = useState(""); const [amount, setAmount] = useState("");
  const [basis, setBasis] = useState("Flat"); const [scope, setScope] = useState("All flats");
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [due, setDue] = useState(new Date().toISOString().slice(0,10)); const [preview, setPreview] = useState<any>(null);
  const [vendorName, setVendorName] = useState(""); const [category, setCategory] = useState(""); const [phone, setPhone] = useState("");
  const [vendor, setVendor] = useState(""); const [invoice, setInvoice] = useState(""); const [title, setTitle] = useState("");
  const [csv, setCsv] = useState("reference,occurred_at,description,amount\n"); const [bankPreview, setBankPreview] = useState<any>(null);
  const [flat, setFlat] = useState(""); const [year, setYear] = useState(String(new Date().getFullYear()));
  const [exportError, setExportError] = useState<Error | null>(null);
  const ledger = useApi<any>(`/admin/finance/ledger/${flat}`, undefined, !!flat);
  const flatLabel = (u: any) => `${u.building} / ${u.number}`;
  const selectedUnit = units.data?.find(u => flatLabel(u) === scope)?.id ?? null;
  const cycle = {month, due_date: `${due}T23:59:59+05:30`};
  return <Screen><Header title="Office accounts" subtitle="Billing rules, expenses and reconciliation" />
    <ErrorState error={units.error || account.error} retry={units.refetch} />
    <Card><Txt weight="bold">Online collections: {account.data?.configured ? "Account configured" : "Not configured"}</Txt>
      <Txt muted>Collections use this society's own payment account. Contact your platform administrator to configure credentials.</Txt>
      <Txt selectable>Society reference: {account.data?.society_id}</Txt></Card>
    <Chips options={["Billing rules", "Monthly bills", "Schedule", "Cheques", "Expenses", "Bank matching", "Flat ledger", "Export"]} value={tab} onChange={setTab} />
    {tab === "Schedule" && <Schedule />}
    {tab === "Billing rules" && <><FormCard title="Add a recurring charge">
      <Input label="Charge name" value={label} onChange={setLabel} /><Input label={basis === "Area" ? "₹ per square foot" : "₹ per flat"} value={amount} onChange={setAmount} numeric />
      <Chips options={["Flat", "Area"]} value={basis} onChange={setBasis} />
      <Chips options={["All flats", ...(units.data ?? []).map(flatLabel)]} value={scope} onChange={setScope} />
      <Action title="Add billing rule" path="/admin/finance/rules" body={{label,amount:Math.round(Number(amount)*100),basis,unit_id:selectedUnit}} />
      <Txt muted>Rules add together. Flat-specific rules add an extra charge to that flat.</Txt>
    </FormCard><ErrorState error={rules.error} retry={rules.refetch} />{rules.data?.map(r => <Card key={r.id}>
      <Txt>{r.label} · {money(r.amount)} {r.basis === "Area" ? "/ sq ft" : "/ flat"}</Txt>
      <Action title="Deactivate rule" path={`/admin/finance/rules/${r.id}`} method="DELETE" danger /></Card>)}</>}
    {tab === "Monthly bills" && <FormCard title="Preview and publish bills">
      <Input label="Billing month (YYYY-MM)" value={month} onChange={v => {setMonth(v);setPreview(null);}} />
      <Input label="Due date (YYYY-MM-DD)" value={due} onChange={v => {setDue(v);setPreview(null);}} />
      <Action title="Preview bills" path="/admin/finance/cycle" body={{...cycle,preview:true}} after={setPreview} />
      {preview && <><Txt weight="bold">New charges: {money(preview.total)}</Txt>
        {preview.units.map((u: any) => <Txt key={u.unit_id}>{u.flat}: {money(u.amount)} {u.existing ? "· Already billed" : ""}</Txt>)}
        <Action title="Publish bills" path="/admin/finance/cycle" body={{...cycle,preview:false}} after={r => {setPreview(null);}} /></>}
    </FormCard>}
    {tab === "Cheques" && <><ErrorState error={cheques.error} retry={cheques.refetch} />{cheques.data?.length === 0 && <Txt>No cheques awaiting clearance.</Txt>}
      {cheques.data?.map(p => <Card key={p.id}><Txt weight="bold">{money(p.amount)} · {p.reference}</Txt>
        <Action title="Confirm bank clearance" path={`/admin/finance/cheques/${p.id}`} body={{decision:"Cleared"}} />
        <Action title="Record bounced cheque" path={`/admin/finance/cheques/${p.id}`} body={{decision:"Bounced"}} danger /></Card>)}</>}
    {tab === "Expenses" && <><FormCard title="Add vendor">
      <Input label="Vendor name" value={vendorName} onChange={setVendorName} /><Input label="Category" value={category} onChange={setCategory} /><Input label="Phone" value={phone} onChange={setPhone} />
      <Action title="Add vendor" path="/admin/finance/vendors" body={{name:vendorName,category,phone}} />
    </FormCard><FormCard title="Submit an expense">
      <Chips options={vendors.data?.map(v=>v.name) ?? []} value={vendor} onChange={setVendor} />
      <Input label="Description" value={title} onChange={setTitle} /><Input label="Invoice number" value={invoice} onChange={setInvoice} />
      <Input label="Amount (₹)" value={amount} onChange={setAmount} numeric /><Input label="Due date (YYYY-MM-DD)" value={due} onChange={setDue} />
      <Action title="Submit for approval" path="/admin/finance/expenses" body={{vendor_id:vendors.data?.find(v=>v.name===vendor)?.id ?? "",title,invoice_number:invoice,amount:Math.round(Number(amount)*100),due_at:`${due}T23:59:59+05:30`}} />
    </FormCard><ErrorState error={expenses.error || vendors.error} retry={expenses.refetch} />
      {expenses.data?.map(e=><ExpenseCard key={e.id} row={e}/>)}</>}
    {tab === "Bank matching" && <><FormCard title="Import bank statement">
      <Txt muted>Use reference,occurred_at,description,amount. Dates include timezone (2026-10-03T12:00:00+05:30). Amounts are paise; deposits positive, withdrawals negative.</Txt>
      <Input label="CSV statement" value={csv} onChange={v=>{setCsv(v);setBankPreview(null);}} multiline />
      <Action title="Preview statement" path="/admin/finance/bank/import-csv" body={{csv,preview:true}} after={setBankPreview} />
      {bankPreview && <><Txt>{bankPreview.count} new transactions · {bankPreview.skipped} existing references</Txt>
        <Action title="Import statement" path="/admin/finance/bank/import-csv" body={{csv,preview:false}} after={()=>setBankPreview(null)} /></>}
    </FormCard><ErrorState error={bank.error} retry={bank.refetch}/>{bank.data?.map(t=><BankCard key={t.id} row={t}/>)}</>}
    {tab === "Flat ledger" && <><Chips options={units.data?.map(flatLabel) ?? []} value={flatLabel(units.data?.find(u=>u.id===flat) ?? {})}
      onChange={v=>setFlat(units.data?.find(u=>flatLabel(u)===v)?.id ?? "")} />
      <ErrorState error={ledger.error} retry={ledger.refetch}/>{ledger.data && <>
        <Txt weight="bold">Outstanding: {money(ledger.data.outstanding)}</Txt>
        {ledger.data.bills.map((b:any)=><CreditCard key={b.id} bill={b}/>)}
        {ledger.data.payments.map((p:any)=><Card key={p.id}><Txt>{money(p.amount)} · {p.method} · {p.status}</Txt><Txt>{p.reference}</Txt></Card>)}
        {ledger.data.credits.map((c:any)=><Card key={c.id}><Txt>Credit {money(c.amount)} · {c.reason}</Txt></Card>)}
      </>}</>}
    {tab === "Export" && <FormCard title="Financial-year cashbook"><Input label="Financial year starting April (YYYY)" value={year} onChange={setYear} numeric />
      <Txt muted>Exports paid collections and expenses. This is a cashbook for your accountant, not a balance sheet.</Txt>
      <Button title="Export CSV" onPress={()=>{void shareFile(`/admin/finance/report.csv?financial_year=${year}`,`cashbook-${year}.csv`).catch(setExportError);}} />
      <ErrorState error={exportError}/></FormCard>}
  </Screen>;
}
function ExpenseCard({row}:{row:any}) {
  const [reference,setReference]=useState("");
  return <Card><Txt weight="bold">{row.title} · {money(row.amount)}</Txt><Txt>{row.status} · {row.invoice_number}</Txt>
    {row.status === "Submitted" && <><Action title="Approve expense" path={`/admin/finance/expenses/${row.id}`} method="PATCH" body={{status:"Approved"}} />
      <Action title="Reject expense" path={`/admin/finance/expenses/${row.id}`} method="PATCH" body={{status:"Rejected"}} danger /></>}
    {row.status === "Approved" && <><Input label="Bank payment reference" value={reference} onChange={setReference}/>
      <Action title="Record payment" path={`/admin/finance/expenses/${row.id}`} method="PATCH" body={{status:"Paid",reference}} /></>}
  </Card>;
}

function Schedule() {
  const query=useApi<{enabled:boolean;due_day:number;reminders:boolean}>("/admin/finance/schedule");
  const [enabled,setEnabled]=useState("No");const [reminders,setReminders]=useState("No");const [day,setDay]=useState("10");
  useEffect(()=>{if(query.data){setEnabled(query.data.enabled?"Yes":"No");setReminders(query.data.reminders?"Yes":"No");setDay(String(query.data.due_day));}},[query.data]);
  return <FormCard title="Automatic monthly billing"><ErrorState error={query.error} retry={query.refetch}/>
    <Txt>Generate each month's bills automatically from active rules</Txt><Chips options={["Yes","No"]} value={enabled} onChange={setEnabled}/>
    <Input label="Due day of each month (1–28)" value={day} onChange={setDay} numeric/>
    <Txt>Send overdue reminders at most once per week</Txt><Chips options={["Yes","No"]} value={reminders} onChange={setReminders}/>
    <Txt muted>Enabling billing can generate the current month's bills on the next scheduled run. Preview the current rules before enabling.</Txt>
    <Action title="Save billing schedule" path="/admin/finance/schedule" method="PUT" body={{enabled:enabled==="Yes",reminders:reminders==="Yes",due_day:Number(day)}}/>
  </FormCard>;
}
function BankCard({row}:{row:any}) {
  const [record,setRecord]=useState("");
  const candidates=useApi<{id:string;label:string}[]>(`/admin/finance/bank/${row.id}/candidates`,undefined,!row.payment_id&&!row.expense_id);
  return <Card><Txt>{row.reference} · {money(row.amount)}</Txt><Txt>{row.description}</Txt>
    {row.payment_id || row.expense_id ? <Txt>Reconciled</Txt> : <><Txt>Choose the matching {row.amount>0?"collection":"expense"}</Txt><ErrorState error={candidates.error} retry={candidates.refetch}/><Chips options={candidates.data?.map(c=>c.label) ?? []} value={candidates.data?.find(c=>c.id===record)?.label ?? ""} onChange={label=>setRecord(candidates.data?.find(c=>c.label===label)?.id ?? "")}/>
      <Action title="Match transaction" path={`/admin/finance/bank/${row.id}/match`} body={{kind:row.amount>0?"Payment":"Expense",record_id:record}} /></>}
  </Card>;
}
function CreditCard({bill}:{bill:any}) {
  const [amount,setAmount]=useState(""); const [reason,setReason]=useState("");
  return <Card><Txt weight="bold">{bill.period} · {money(bill.outstanding)} due</Txt>
    {bill.outstanding>0 && <><Input label="Credit adjustment (₹)" value={amount} onChange={setAmount} numeric /><Input label="Reason" value={reason} onChange={setReason}/>
      <Action title="Issue credit adjustment" path={`/admin/finance/bills/${bill.id}/credit`} body={{amount:Math.round(Number(amount)*100),reason}} /></>}
  </Card>;
}
