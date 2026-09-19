import { router } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Badge,
  Button,
  Loading,
  ErrorState,
  Empty,
} from "../../src/components/ui";
import { usePages } from "../../src/lib/api";
import { date } from "../../src/lib/format";
import type { Notice } from "../../src/types/api";
export default function Notices() {
  const query = usePages<Notice>("/notices");
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header title="Notice board" subtitle="The latest from your community." />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error} retry={query.refetch} />
      {query.data?.pages
        .flatMap((p) => p.items)
        .map((notice) => (
          <Card
            key={notice.id}
            onPress={() => router.push(`/notices/${notice.id}`)}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <Badge status={notice.category} />
              <Txt muted style={{ fontSize: 11 }}>
                {date(notice.published_at)}
              </Txt>
            </Row>
            <Txt weight="extra" style={{ fontSize: 20, lineHeight: 28 }}>
              {notice.title}
            </Txt>
            <Txt muted numberOfLines={3}>
              {notice.content}
            </Txt>
            {notice.priority !== "Normal" && <Badge status={notice.priority} />}
          </Card>
        ))}
      {query.data?.pages[0].total === 0 && (
        <Empty
          title="No notices available"
          description="Community updates will appear here."
          icon="megaphone-outline"
        />
      )}
      {query.hasNextPage && (
        <Button
          title="Load more"
          secondary
          onPress={() => void query.fetchNextPage()}
          loading={query.isFetchingNextPage}
        />
      )}
    </Screen>
  );
}
