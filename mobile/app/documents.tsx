import { useState } from "react";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Icon,
  Button,
  Loading,
  ErrorState,
  Empty,
  Chips,
} from "../src/components/ui";
import { usePages, useAction } from "../src/lib/api";
import { shareFile } from "../src/lib/files";
import { date } from "../src/lib/format";
import type { SocietyDocument } from "../src/types/api";
export default function Documents() {
  const query = usePages<SocietyDocument>("/documents");
  const [category, setCategory] = useState("All");
  const all = query.data?.pages.flatMap((p) => p.items) ?? [];
  const download = useAction((document: SocietyDocument) =>
    shareFile(
      `/documents/${document.id}/download`,
      `document-${document.id}.pdf`,
    ),
  );
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header
        title="Society documents"
        subtitle="Useful information. Always within reach."
      />
      <Chips
        options={["All", ...new Set(all.map((d) => d.category))]}
        value={category}
        onChange={setCategory}
      />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error || download.error} retry={query.refetch} />
      {all
        .filter((d) => category === "All" || d.category === category)
        .map((document) => (
          <Card key={document.id}>
            <Row>
              <Icon name="document-text-outline" size={32} />
              <Txt weight="bold" style={{ fontSize: 16, flex: 1 }}>
                {document.title}
              </Txt>
            </Row>
            <Txt muted style={{ fontSize: 12 }}>
              {document.category} · {date(document.created_at)}
            </Txt>
            <Button
              title="View / download PDF"
              secondary
              icon="download-outline"
              loading={
                download.isPending && download.variables?.id === document.id
              }
              onPress={() => download.mutate(document)}
            />
          </Card>
        ))}
      {query.data?.pages[0].total === 0 && (
        <Empty title="No documents available" icon="folder-open-outline" />
      )}
      {query.hasNextPage && (
        <Button
          title="Load more"
          secondary
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </Screen>
  );
}
