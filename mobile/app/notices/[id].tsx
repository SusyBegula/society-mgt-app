import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Badge,
  Button,
  Loading,
  ErrorState,
} from "../../src/components/ui";
import { useApi, useAction } from "../../src/lib/api";
import { shareFile } from "../../src/lib/files";
import { date } from "../../src/lib/format";
import type { Notice } from "../../src/types/api";
export default function NoticeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApi<Notice>(`/notices/${id}`);
  const download = useAction((id: string) =>
    shareFile(`/documents/${id}/download`, `notice-attachment-${id}.pdf`),
  );
  const d = query.data;
  return (
    <Screen>
      <Header title="Community notice" />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error || download.error} retry={query.refetch} />
      {d && (
        <Card style={{ padding: 24 }}>
          <Badge status={d.category} />
          <Txt weight="extra" style={{ fontSize: 29, lineHeight: 39 }}>
            {d.title}
          </Txt>
          <Txt muted style={{ fontSize: 12 }}>
            Published {date(d.published_at)}
          </Txt>
          <Txt style={{ fontSize: 15, lineHeight: 28, marginTop: 12 }}>
            {d.content}
          </Txt>
          {d.attachments.map((attachment, index) => (
            <Button
              key={attachment}
              title={`Open attachment ${index + 1}`}
              secondary
              icon="document-text-outline"
              loading={download.isPending}
              onPress={() => download.mutate(attachment)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
