import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import {
  Screen,
  Header,
  Txt,
  Button,
  ErrorState,
} from "../../src/components/ui";
import { Field } from "../../src/components/form";
import { useAction, send } from "../../src/lib/api";
import { localDay, phone } from "../../src/lib/format";
import type { Invitation } from "../../src/types/api";
const schema = z
  .object({
    name: z.string().min(2, "Enter a name").max(100),
    mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    start: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time HH:MM"),
    end: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time HH:MM"),
    vehicle_number: z.string().max(20),
    notes: z.string().max(500),
  })
  .refine(
    (v) =>
      new Date(`${v.day}T${v.end}:00`) > new Date(`${v.day}T${v.start}:00`),
    { message: "End time must be after start time", path: ["end"] },
  );
export default function Invite() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      mobile: "",
      day: localDay(1),
      start: "18:00",
      end: "21:00",
      vehicle_number: "",
      notes: "",
    },
  });
  const action = useAction(async (values: z.infer<typeof schema>) => {
    const invitation = await send<Invitation>("/visitors/invitations", "POST", {
      name: values.name,
      phone: phone(values.mobile),
      start_at: new Date(`${values.day}T${values.start}:00`).toISOString(),
      end_at: new Date(`${values.day}T${values.end}:00`).toISOString(),
      vehicle_number: values.vehicle_number,
      notes: values.notes,
    });
    router.replace({
      pathname: "/visitors/invitation",
      params: { id: invitation.id },
    });
  });
  return (
    <Screen>
      <Header title="Invite a visitor" />
      <Txt muted>Share an entry pass for a smoother arrival.</Txt>
      <Field
        control={form.control}
        name="name"
        label="Visitor name"
        placeholder="Full name"
      />
      <Field
        control={form.control}
        name="mobile"
        label="Mobile number (+91)"
        keyboardType="phone-pad"
        maxLength={10}
        placeholder="10-digit number"
      />
      <Field
        control={form.control}
        name="day"
        label="Visit date"
        placeholder="YYYY-MM-DD"
        maxLength={10}
      />
      <Field
        control={form.control}
        name="start"
        label="Start time (24-hour, local time)"
        placeholder="18:00"
        maxLength={5}
      />
      <Field
        control={form.control}
        name="end"
        label="End time (24-hour, local time)"
        placeholder="21:00"
        maxLength={5}
      />
      <Field
        control={form.control}
        name="vehicle_number"
        label="Vehicle number (optional)"
        autoCapitalize="characters"
      />
      <Field
        control={form.control}
        name="notes"
        label="Notes (optional)"
        multiline
      />
      <ErrorState error={action.error} />
      <Button
        title="Create invitation"
        loading={action.isPending}
        onPress={form.handleSubmit((v) => action.mutate(v))}
      />
    </Screen>
  );
}
