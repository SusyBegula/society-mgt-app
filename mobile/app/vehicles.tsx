import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Confirm,
} from "../src/components/ui";
import { Field, ChoiceField } from "../src/components/form";
import { useApi, useAction, send } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Vehicle } from "../src/types/api";
const schema = z.object({
  kind: z.enum(["Car", "Bike"]),
  registration: z
    .string()
    .min(6)
    .max(20)
    .regex(/^[A-Z0-9 -]+$/, "Use uppercase letters and numbers"),
  manufacturer: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  color: z.string().min(1).max(30),
});
type Values = z.infer<typeof schema>;
const defaults: Values = {
  kind: "Car",
  registration: "",
  manufacturer: "",
  model: "",
  color: "",
};
export default function Vehicles() {
  const query = useApi<Vehicle[]>("/vehicles");
  const eligible = useSession((s) => s.property?.role !== "Family Member");
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const save = useAction(async (data: Values) => {
    await send(
      editing === "new" ? "/vehicles" : `/vehicles/${(editing as Vehicle).id}`,
      editing === "new" ? "POST" : "PUT",
      data,
    );
    setEditing(null);
  });
  const remove = useAction(async () => {
    await send(`/vehicles/${removing!.id}`, "DELETE");
    setRemoving(null);
  });
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header title="Vehicles & parking" />
      {query.isLoading && <Loading />}
      <ErrorState
        error={query.error || save.error || remove.error}
        retry={query.refetch}
      />
      {editing ? (
        <>
          <Txt weight="bold">
            {editing === "new" ? "Register a vehicle" : "Edit vehicle"}
          </Txt>
          <ChoiceField
            control={form.control}
            name="kind"
            label="Vehicle type"
            options={["Car", "Bike"]}
          />
          <Field
            control={form.control}
            name="registration"
            label="Registration number"
            autoCapitalize="characters"
            placeholder="MH12AB1234"
          />
          <Field
            control={form.control}
            name="manufacturer"
            label="Manufacturer"
            placeholder="Hyundai"
          />
          <Field
            control={form.control}
            name="model"
            label="Model"
            placeholder="Creta"
          />
          <Field
            control={form.control}
            name="color"
            label="Color"
            placeholder="White"
          />
          <Txt muted style={{ fontSize: 12 }}>
            Parking slots are assigned by your society office.
          </Txt>
          <Button
            title="Save vehicle"
            loading={save.isPending}
            onPress={form.handleSubmit((v) => save.mutate(v))}
          />
          <Button title="Cancel" secondary onPress={() => setEditing(null)} />
        </>
      ) : (
        <>
          {query.data?.map((vehicle) => (
            <Card key={vehicle.id}>
              <Row>
                <Icon
                  name={
                    vehicle.kind === "Car" ? "car-outline" : "bicycle-outline"
                  }
                  size={38}
                />
                <Txt weight="extra" style={{ fontSize: 20 }}>
                  {vehicle.registration}
                </Txt>
              </Row>
              <Txt muted>
                {vehicle.manufacturer} {vehicle.model} · {vehicle.color}
              </Txt>
              <Row>
                <Icon name="location-outline" size={18} />
                <Txt weight="semibold">Parking · {vehicle.parking_slot}</Txt>
              </Row>
              {eligible && (
                <Row>
                  <Button
                    title="Edit"
                    secondary
                    style={{ flex: 1 }}
                    onPress={() => {
                      form.reset({
                        kind: vehicle.kind,
                        registration: vehicle.registration,
                        manufacturer: vehicle.manufacturer,
                        model: vehicle.model,
                        color: vehicle.color,
                      });
                      setEditing(vehicle);
                    }}
                  />
                  <Button
                    title="Remove"
                    secondary
                    danger
                    style={{ flex: 1 }}
                    onPress={() => setRemoving(vehicle)}
                  />
                </Row>
              )}
            </Card>
          ))}
          {query.data?.length === 0 && (
            <Empty title="No vehicles registered" icon="car-outline" />
          )}
          {eligible && (
            <Button
              title="Add a vehicle"
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
        title="Remove this vehicle?"
        message={removing?.registration ?? ""}
        onCancel={() => setRemoving(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
      />
    </Screen>
  );
}
