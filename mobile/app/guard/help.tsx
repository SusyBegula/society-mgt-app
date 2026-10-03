import { Screen, Header, Card, Txt, ErrorState } from "../../src/components/ui";
import { Action } from "../../src/components/office";
import { useApi } from "../../src/lib/api";
export default function DomesticHelpGate() {
  const query=useApi<any[]>("/guard/help",10000);
  return <Screen refresh={query.refetch}><Header title="Domestic help attendance"/><ErrorState error={query.error} retry={query.refetch}/>
    {query.data?.map(h=><Card key={h.id}><Txt weight="bold">{h.name} · {h.kind}</Txt><Txt>{h.status}</Txt>
      <Action title={h.status==="Inside"?"Record exit":"Record entry"} path={`/guard/help/${h.id}/${h.status==="Inside"?"exit":"entry"}`}/></Card>)}
  </Screen>;
}
