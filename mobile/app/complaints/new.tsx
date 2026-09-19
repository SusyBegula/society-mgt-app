import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Screen,
  Header,
  Button,
  ErrorState,
  Row,
  Txt,
  Icon,
} from "../../src/components/ui";
import { Field, ChoiceField } from "../../src/components/form";
import { useAction, send } from "../../src/lib/api";
import { pickImage } from "../../src/lib/files";
import type { Complaint } from "../../src/types/api";
const categories = [
  "Plumbing",
  "Electrical",
  "Lift",
  "Security",
  "Housekeeping",
  "Parking",
  "Common Area",
  "Other",
];
const schema = z.object({
  title: z.string().min(3, "Add a short title").max(150),
  description: z
    .string()
    .min(10, "Please describe the issue in a little more detail")
    .max(5000),
  category: z.string().min(1),
  priority: z.string(),
});
export default function NewComplaint() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      category: "Plumbing",
      priority: "Normal",
    },
  });
  const [attachments, setAttachments] = useState<{ id: string; uri: string }[]>(
    [],
  );
  const upload = useAction(async () => {
    const image = await pickImage();
    if (image) setAttachments((a) => [...a, image]);
  });
  const action = useAction(async (values: z.infer<typeof schema>) => {
    const row = await send<Complaint>("/complaints", "POST", {
      ...values,
      attachments: attachments.map((a) => a.id),
    });
    router.replace(`/complaints/${row.id}`);
  });
  return (
    <Screen>
      <Header title="Raise a complaint" />
      <ChoiceField
        control={form.control}
        name="category"
        label="What is it about?"
        options={categories}
      />
      <Field
        control={form.control}
        name="title"
        label="Title"
        placeholder="A short summary of the issue"
      />
      <Field
        control={form.control}
        name="description"
        label="Description"
        placeholder="Tell us what happened and where…"
        multiline
      />
      <ChoiceField
        control={form.control}
        name="priority"
        label="Priority"
        options={["Low", "Normal", "High", "Urgent"]}
      />
      <Txt weight="semibold">Photos (optional)</Txt>
      <Row style={{ flexWrap: "wrap" }}>
        {attachments.map((a) => (
          <View key={a.id}>
            <Image
              source={{ uri: a.uri }}
              style={{ width: 76, height: 76, borderRadius: 12 }}
            />
            <Pressable
              accessibilityLabel="Remove attachment"
              onPress={() =>
                setAttachments(attachments.filter((v) => v.id !== a.id))
              }
              style={{
                position: "absolute",
                top: -7,
                right: -7,
                padding: 8,
                backgroundColor: "#fff",
                borderRadius: 30,
              }}
            >
              <Icon name="close" size={17} />
            </Pressable>
          </View>
        ))}
      </Row>
      <Button
        title="Attach photo"
        icon="camera-outline"
        secondary
        loading={upload.isPending}
        disabled={attachments.length >= 5}
        onPress={() => upload.mutate()}
      />
      <Txt muted style={{ fontSize: 11 }}>
        Up to 5 photos · JPG, PNG or WebP · 10 MB each
      </Txt>
      <ErrorState error={action.error || upload.error} />
      <Button
        title="Submit complaint"
        loading={action.isPending}
        disabled={upload.isPending}
        onPress={form.handleSubmit((v) => action.mutate(v))}
      />
    </Screen>
  );
}
