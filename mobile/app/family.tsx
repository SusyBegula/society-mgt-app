import { useState } from "react";
import { Switch, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Avatar,
  Badge,
  Button,
  Loading,
  ErrorState,
  Empty,
  Confirm,
} from "../src/components/ui";
import { Field, ChoiceField } from "../src/components/form";
import { useApi, useAction, send } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { phone } from "../src/lib/format";
import { colors as c } from "../src/theme";
import type { FamilyMember } from "../src/types/api";
const schema = z.object({
  name: z.string().min(2).max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
  relationship: z.string(),
  app_access: z.boolean(),
});
type Values = z.infer<typeof schema>;
const defaults: Values = {
  name: "",
  mobile: "",
  relationship: "Spouse",
  app_access: false,
};
export default function Family() {
  const query = useApi<FamilyMember[]>("/residents/family");
  const eligible = useSession((s) => s.property?.role !== "Family Member");
  const [editing, setEditing] = useState<FamilyMember | "new" | null>(null);
  const [removing, setRemoving] = useState<FamilyMember | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const save = useAction(async ({ mobile, ...data }: Values) => {
    await send(
      editing === "new"
        ? "/residents/family"
        : `/residents/family/${(editing as FamilyMember).id}`,
      editing === "new" ? "POST" : "PUT",
      { ...data, phone: phone(mobile) },
    );
    setEditing(null);
  });
  const remove = useAction(async () => {
    await send(`/residents/family/${removing!.id}`, "DELETE");
    setRemoving(null);
  });
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header title="Family members" subtitle="The people who make it home." />
      {query.isLoading && <Loading />}
      <ErrorState
        error={query.error || save.error || remove.error}
        retry={query.refetch}
      />
      {editing ? (
        <>
          <Field control={form.control} name="name" label="Full name" />
          <Field
            control={form.control}
            name="mobile"
            label="Mobile number (+91)"
            keyboardType="phone-pad"
            maxLength={10}
          />
          <ChoiceField
            control={form.control}
            name="relationship"
            label="Relationship"
            options={["Spouse", "Child", "Parent", "Sibling", "Other"]}
          />
          <Card>
            <Row>
              <View style={{ flex: 1 }}>
                <Txt weight="bold">Allow app access</Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  They can sign in with this mobile number.
                </Txt>
              </View>
              <Controller
                control={form.control}
                name="app_access"
                render={({ field }) => (
                  <Switch
                    accessibilityLabel="Allow app access"
                    value={field.value}
                    onValueChange={field.onChange}
                    trackColor={{ true: c.primary }}
                  />
                )}
              />
            </Row>
          </Card>
          <Button
            title="Save family member"
            loading={save.isPending}
            onPress={form.handleSubmit((v) => save.mutate(v))}
          />
          <Button title="Cancel" secondary onPress={() => setEditing(null)} />
        </>
      ) : (
        <>
          {query.data?.map((member) => (
            <Card key={member.id}>
              <Row>
                <Avatar name={member.name} />
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" style={{ fontSize: 17 }}>
                    {member.name}
                  </Txt>
                  <Txt muted style={{ fontSize: 12 }}>
                    {member.relationship} · {member.phone}
                  </Txt>
                </View>
              </Row>
              <Badge
                status={
                  member.app_access ? "Active app access" : "No app access"
                }
              />
              {eligible && (
                <Row>
                  <Button
                    title="Edit"
                    secondary
                    style={{ flex: 1 }}
                    onPress={() => {
                      form.reset({
                        name: member.name,
                        mobile: member.phone.slice(3),
                        relationship: member.relationship,
                        app_access: member.app_access,
                      });
                      setEditing(member);
                    }}
                  />
                  <Button
                    title="Remove"
                    secondary
                    danger
                    style={{ flex: 1 }}
                    onPress={() => setRemoving(member)}
                  />
                </Row>
              )}
            </Card>
          ))}
          {query.data?.length === 0 && (
            <Empty title="No family members added" icon="people-outline" />
          )}
          {eligible && (
            <Button
              title="Add family member"
              icon="add"
              onPress={() => {
                form.reset(defaults);
                setEditing("new");
              }}
            />
          )}
        </>
      )}
      <Confirm
        visible={!!removing}
        title="Remove family member?"
        message="Their access to this flat will be revoked."
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
      />
    </Screen>
  );
}
