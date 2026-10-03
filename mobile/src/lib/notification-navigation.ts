import { router } from "expo-router";
import { queryClient, request } from "./api";
import { useSession } from "./session";
import type { Property } from "../types/api";

export const notificationRoute = (route: unknown): route is string =>
  typeof route === "string" && /^\/(visitors|payments|bills|complaints|notices|bookings|emergency|receipt|guard|admin|properties|community|privacy|refunds|parcels)(\/|$)/.test(route);

export async function openPushNotification(data: Record<string, unknown>) {
  if (!notificationRoute(data.route) || !useSession.getState().tokens) return;
  const properties = await request<Property[]>("/properties");
  const matching = properties.filter(property => property.society_id === data.society_id &&
    (!data.property_id || property.id === data.property_id));
  // Legacy notifications cannot disambiguate two flats or roles in one society.
  if (matching.length !== 1) {
    router.push("/properties?switch=true");
    return;
  }
  await queryClient.cancelQueries();
  queryClient.clear();
  await useSession.getState().setProperty(matching[0]);
  router.push(data.route as never);
}
