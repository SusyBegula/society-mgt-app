import Constants from "expo-constants";
import { useSession } from "./session";
import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Page } from "../types/api";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  "https://society-mgt-app.onrender.com"
).replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        count < 1 && (!(error instanceof ApiError) || error.status >= 500),
    },
    mutations: { retry: false },
  },
});
let refreshing: Promise<void> | null = null;

async function refreshSession() {
  const refreshToken = useSession.getState().tokens?.refresh_token;
  if (!refreshToken) throw new ApiError("Please sign in again.", 401);
  try {
    const tokens = await request<{
      access_token: string;
      refresh_token: string;
    }>(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) },
      false,
    );
    if (useSession.getState().tokens?.refresh_token === refreshToken)
      await useSession.getState().setTokens(tokens);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await useSession.getState().clear();
      queryClient.clear();
    }
    throw error;
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
  retried = false,
): Promise<T> {
  if (!API_URL)
    throw new ApiError(
      "Set the API address in the mobile environment configuration.",
    );
  const session = useSession.getState();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (authenticated && session.tokens)
    headers.set("Authorization", `Bearer ${session.tokens.access_token}`);
  if (authenticated && session.property && !headers.has("X-Property-Id"))
    headers.set("X-Property-Id", session.property.id);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    if (response.status === 401 && authenticated && !retried) {
      if (!refreshing)
        refreshing = refreshSession().finally(() => {
          refreshing = null;
        });
      await refreshing;
      return request<T>(path, options, authenticated, true);
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(
        data?.error?.message ??
          "We could not complete this request. Please try again.",
        response.status,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error && error.name === "AbortError"
        ? "The request timed out. Please try again."
        : "Unable to connect. Check your internet connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function useApi<T>(path: string) {
  const property = useSession((s) => s.property?.id);
  return useQuery({
    queryKey: [property, path],
    queryFn: () => request<T>(path),
    enabled: !!useSession((s) => s.tokens),
  });
}

export function usePages<T>(path: string) {
  const property = useSession((s) => s.property?.id);
  return useInfiniteQuery({
    queryKey: [property, path, "pages"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      request<Page<T>>(`${path}?offset=${pageParam}&limit=20`),
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total
        ? last.offset + last.items.length
        : undefined,
  });
}

export function useAction<T = unknown, V = void>(
  action: (value: V) => Promise<T>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
}

export const send = <T = unknown>(
  path: string,
  method: string,
  data?: unknown,
) =>
  request<T>(path, {
    method,
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
