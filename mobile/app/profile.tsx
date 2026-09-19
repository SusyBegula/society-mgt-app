import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Screen,
  Header,
  Card,
  Txt,
  Avatar,
  Badge,
  Button,
  Loading,
  ErrorState,
  DetailRow,
  ListItem,
} from "../src/components/ui";
import { Field } from "../src/components/form";
import { useApi, useAction, send, API_URL } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { pickImage } from "../src/lib/files";
import type { Profile } from "../src/types/api";
const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.union([z.email(), z.literal("")]),
});
export default function ProfileScreen() {
  const query = useApi<Profile>("/residents/me");
  const session = useSession();
  const property = session.property!;
  const [editing, setEditing] = useState(false);
  const [avatar, setAvatar] = useState<{ id: string; uri: string } | null>(
    null,
  );
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "" },
  });
  useEffect(() => {
    if (query.data)
      form.reset({ name: query.data.name, email: query.data.email });
  }, [query.data]);
  const upload = useAction(async () => {
    const image = await pickImage();
    if (image) setAvatar(image);
  });
  const save = useAction(async (data: z.infer<typeof schema>) => {
    await send("/residents/me", "PATCH", {
      ...data,
      avatar_id: avatar?.id ?? query.data?.avatar_id ?? null,
    });
    setEditing(false);
  });
  const d = query.data;
  const imageSource = avatar
    ? { uri: avatar.uri }
    : d?.avatar_id
      ? {
          uri: `${API_URL}/uploads/${d.avatar_id}`,
          headers: {
            Authorization: `Bearer ${session.tokens?.access_token}`,
            "X-Property-Id": property.id,
          },
        }
      : null;
  return (
    <Screen>
      <Header title="My profile" />
      {query.isLoading && <Loading />}
      <ErrorState
        error={query.error || save.error || upload.error}
        retry={query.refetch}
      />
      {d && (
        <>
          <View style={{ alignItems: "center", gap: 11, paddingVertical: 15 }}>
            {imageSource ? (
              <Image
                accessibilityLabel="Profile photo"
                source={imageSource}
                style={{ width: 88, height: 88, borderRadius: 45 }}
              />
            ) : (
              <Avatar name={d.name} size={88} />
            )}
            <Txt weight="extra" style={{ fontSize: 25, lineHeight: 33 }}>
              {d.name}
            </Txt>
            <Badge status={property.role} />
          </View>
          {editing ? (
            <>
              <Button
                title="Change photo"
                secondary
                icon="camera-outline"
                loading={upload.isPending}
                onPress={() => upload.mutate()}
              />
              <Field control={form.control} name="name" label="Full name" />
              <Field
                control={form.control}
                name="email"
                label="Email address (optional)"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Button
                title="Save changes"
                loading={save.isPending}
                disabled={upload.isPending}
                onPress={form.handleSubmit((v) => save.mutate(v))}
              />
              <Button
                title="Cancel"
                secondary
                onPress={() => {
                  setEditing(false);
                  setAvatar(null);
                }}
              />
            </>
          ) : (
            <>
              <Card>
                <DetailRow label="Mobile" value={d.phone} />
                <DetailRow label="Email" value={d.email || "Not added"} />
                <DetailRow label="Society" value={property.society} />
                <DetailRow
                  label="Tower / Flat"
                  value={`${property.tower} / ${property.flat}`}
                />
                <DetailRow label="Resident role" value={property.role} />
              </Card>
              <Button
                title="Edit profile"
                secondary
                onPress={() => setEditing(true)}
              />
              <Card style={{ paddingVertical: 4 }}>
                <ListItem
                  icon="people-outline"
                  title="Family members"
                  onPress={() => router.push("/family")}
                />
                <ListItem
                  icon="car-outline"
                  title="Vehicles"
                  onPress={() => router.push("/vehicles")}
                />
                <ListItem
                  icon="call-outline"
                  title="Emergency contacts"
                  onPress={() => router.push("/directory")}
                />
                <ListItem
                  icon="business-outline"
                  title="My properties"
                  onPress={() => router.push("/properties?switch=true")}
                />
                <ListItem
                  icon="settings-outline"
                  title="Settings"
                  onPress={() => router.push("/settings")}
                />
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
