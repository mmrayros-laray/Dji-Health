// react-query with a persisted cache → the vault stays readable offline (read-only). CLAUDE.md §3.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";

export const OFFLINE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: 30_000,
      gcTime: OFFLINE_MAX_AGE,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { networkMode: "online" },
  },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "djh.query-cache", throttleTime: 1000 });

/** Only record data the patient needs offline is persisted (never AI chat, never dashboards). */
export function shouldPersist(queryKey: readonly unknown[]): boolean {
  return ["record", "schedule", "params", "access", "consents", "role"].includes(String(queryKey[0]));
}
