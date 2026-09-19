import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { Property } from "../types/api";

type Tokens = { access_token: string; refresh_token: string };
type Session = {
  hydrated: boolean;
  tokens: Tokens | null;
  property: Property | null;
  hydrate: () => Promise<void>;
  setTokens: (tokens: Tokens) => Promise<void>;
  setProperty: (property: Property | null) => Promise<void>;
  clear: () => Promise<void>;
};
const KEY = "society.session.v1";
const PROPERTY = "society.property.v1";
export const useSession = create<Session>((set) => ({
  hydrated: false,
  tokens: null,
  property: null,
  hydrate: async () => {
    try {
      const [token, property] = await Promise.all([
        SecureStore.getItemAsync(KEY),
        SecureStore.getItemAsync(PROPERTY),
      ]);
      set({
        tokens: token ? JSON.parse(token) : null,
        property: property ? JSON.parse(property) : null,
      });
    } catch {
      set({ tokens: null, property: null });
    } finally {
      set({ hydrated: true });
    }
  },
  setTokens: async (tokens) => {
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
    set({ tokens });
  },
  setProperty: async (property) => {
    if (property)
      await SecureStore.setItemAsync(PROPERTY, JSON.stringify(property));
    else await SecureStore.deleteItemAsync(PROPERTY);
    set({ property });
  },
  clear: async () => {
    set({ tokens: null, property: null });
    await Promise.all([
      SecureStore.deleteItemAsync(KEY),
      SecureStore.deleteItemAsync(PROPERTY),
    ]);
  },
}));
