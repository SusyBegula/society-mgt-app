import { useState } from "react";
import { Image, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useForm } from "react-hook-form";
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
  Section,
  Chips,
} from "../../src/components/ui";
import { Field } from "../../src/components/form";
import { useApi, useAction, send, API_URL } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import { date, time } from "../../src/lib/format";
import { colors as c } from "../../src/theme";
import type { Complaint } from "../../src/types/api";
export default function ComplaintDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApi<Complaint>(`/complaints/${id}`);
  const form = useForm({ defaultValues: { text: "" } });
  const [rating, setRating] = useState("");
  const comment = useAction(async (data: { text: string }) => {
    if (!data.text.trim()) throw new Error("Write a comment first.");
    await send(`/complaints/${id}/comments`, "POST", data);
    form.reset();
  });
  const resolve = useAction((action: string) =>
    send(`/complaints/${id}/resolution`, "POST", {
      action,
      rating: rating ? Number(rating) : null,
    }),
  );
  const session = useSession();
  const d = query.data;
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header
        title="Complaint details"
        subtitle={`#${id.slice(0, 6).toUpperCase()}`}
      />
      {query.isLoading && <Loading />}
      <ErrorState
        error={query.error || comment.error || resolve.error}
        retry={query.refetch}
      />
      {d && (
        <>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <Badge status={d.status} />
              <Txt muted style={{ fontSize: 11 }}>
                {d.priority} priority
              </Txt>
            </Row>
            <Txt weight="extra" style={{ fontSize: 23, lineHeight: 31 }}>
              {d.title}
            </Txt>
            <Txt muted>{d.description}</Txt>
            <Txt muted style={{ fontSize: 12 }}>
              {d.category} · {date(d.created_at)}
            </Txt>
            {d.assigned_to && (
              <Txt weight="semibold" style={{ fontSize: 12 }}>
                Assigned to {d.assigned_to}
              </Txt>
            )}
            <Row style={{ flexWrap: "wrap" }}>
              {d.attachments.map((attachment) => (
                <Image
                  key={attachment}
                  accessibilityLabel="Complaint attachment"
                  source={{
                    uri: `${API_URL}/uploads/${attachment}`,
                    headers: {
                      Authorization: `Bearer ${session.tokens?.access_token}`,
                      "X-Property-Id": session.property!.id,
                    },
                  }}
                  style={{ width: 100, height: 100, borderRadius: 12 }}
                />
              ))}
            </Row>
          </Card>
          <Section title="Updates & conversation" />
          <Card>
            {d.timeline?.map((item, index) => (
              <Row key={item.id} style={{ alignItems: "flex-start", gap: 14 }}>
                <View style={{ alignItems: "center", width: 12 }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor:
                        item.kind === "status" ? c.primary : c.amber,
                      marginTop: 6,
                    }}
                  />
                  {index !== d.timeline!.length - 1 && (
                    <View
                      style={{
                        width: 1,
                        height: 52,
                        backgroundColor: c.line,
                        marginTop: 4,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1, paddingBottom: 15 }}>
                  <Txt weight={item.kind === "status" ? "semibold" : "regular"}>
                    {item.text}
                  </Txt>
                  <Txt muted style={{ fontSize: 10 }}>
                    {date(item.created_at)} · {time(item.created_at)}
                  </Txt>
                </View>
              </Row>
            ))}
          </Card>
          <Field
            control={form.control}
            name="text"
            label="Add a comment"
            multiline
            placeholder="Share an update or ask a question…"
            maxLength={2000}
          />
          <Button
            title="Post comment"
            secondary
            loading={comment.isPending}
            onPress={form.handleSubmit((v) => comment.mutate(v))}
          />
          {d.status === "Resolved" && (
            <Card>
              <Txt weight="bold">Has the issue been resolved?</Txt>
              <Txt muted style={{ fontSize: 12 }}>
                Rate the service (optional)
              </Txt>
              <Chips
                options={["1", "2", "3", "4", "5"]}
                value={rating}
                onChange={setRating}
              />
              <Button
                title="Yes, confirm resolution"
                loading={resolve.isPending}
                onPress={() => resolve.mutate("confirm")}
              />
              <Button
                title="Still unresolved · Reopen"
                secondary
                onPress={() => resolve.mutate("reopen")}
                disabled={resolve.isPending}
              />
            </Card>
          )}
          {d.rating && <Txt muted>Your rating: {d.rating}/5</Txt>}
        </>
      )}
    </Screen>
  );
}
