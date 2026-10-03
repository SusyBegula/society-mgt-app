import { useState } from "react";
import { Screen, Header, Card, Txt, Chips, ErrorState } from "../src/components/ui";
import { Input, Action, FormCard } from "../src/components/office";
import { useApi } from "../src/lib/api";
import { useSession } from "../src/lib/session";

export default function Community() {
  const role=useSession(s=>s.property?.role); const manager=role==="Admin"||role==="Secretary";
  const meetings=useApi<any[]>("/community/meetings"); const polls=useApi<any[]>("/community/polls");
  const [tab,setTab]=useState("Meetings");const [title,setTitle]=useState("");const [agenda,setAgenda]=useState("");
  const [starts,setStarts]=useState("");const [options,setOptions]=useState("Yes\nNo");
  return <Screen><Header title="Community decisions"/>
    <Chips options={["Meetings","Polls"]} value={tab} onChange={setTab}/>
    <ErrorState error={meetings.error||polls.error} retry={()=>{void meetings.refetch();void polls.refetch();}}/>
    {manager && <FormCard title={tab==="Meetings"?"Schedule a meeting":"Create an advisory poll"}>
      <Input label={tab==="Meetings"?"Meeting title":"Question"} value={title} onChange={setTitle}/>
      <Input label={tab==="Meetings"?"Meeting time (YYYY-MM-DDTHH:MM, India time)":"Closes at (YYYY-MM-DDTHH:MM, India time)"} value={starts} onChange={setStarts}/>
      {tab==="Meetings"?<Input label="Agenda" value={agenda} onChange={setAgenda} multiline/>:<Input label="Options (one per line)" value={options} onChange={setOptions} multiline/>}
      <Action title="Publish" path={tab==="Meetings"?"/admin/meetings":"/admin/polls"} body={tab==="Meetings"?{title,agenda,starts_at:starts+":00+05:30"}:{question:title,options:options.split("\n"),closes_at:starts+":00+05:30"}}/>
    </FormCard>}
    {tab==="Meetings"?meetings.data?.map(m=><MeetingCard key={m.id} meeting={m} manager={manager}/>):<>
      <Txt muted>Advisory community polls: one vote per flat, cast by an owner. These are not formal election proceedings.</Txt>
      {polls.data?.map(p=><PollCard key={p.id} poll={p} owner={role==="Owner"}/>)}</>}
  </Screen>;
}
function MeetingCard({meeting:m,manager}:{meeting:any;manager:boolean}) {
  const [minutes,setMinutes]=useState(m.minutes);
  return <Card><Txt weight="bold">{m.title}</Txt><Txt>{new Date(m.starts_at).toLocaleString()}</Txt><Txt>{m.agenda}</Txt>
    {manager?<><Input label="Meeting minutes" value={minutes} onChange={setMinutes} multiline/><Action title="Publish minutes" path={`/admin/meetings/${m.id}`} method="PUT" body={{title:m.title,agenda:m.agenda,starts_at:m.starts_at,minutes}}/></>:<Txt>{m.minutes || "Minutes have not been published yet."}</Txt>}
  </Card>;
}
function PollCard({poll:p,owner}:{poll:any;owner:boolean}) {
  const [option,setOption]=useState("");const open=new Date(p.closes_at)>new Date();
  return <Card><Txt weight="bold">{p.question}</Txt><Txt>Closes {new Date(p.closes_at).toLocaleString()}</Txt>
    {p.options.map((o:string,i:number)=><Txt key={i}>{o}: {p.counts[i]} votes</Txt>)}
    {p.my_vote!==null?<Txt>Your flat voted: {p.options[p.my_vote]}</Txt>:owner&&open?<><Chips options={p.options} value={option} onChange={setOption}/>
      <Action title="Submit final vote" path={`/community/polls/${p.id}/vote`} body={{option:p.options.indexOf(option)}}/></>:<Txt>{open?"Owner voting only":"Poll closed"}</Txt>}
  </Card>;
}
