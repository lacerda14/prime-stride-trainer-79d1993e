import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createBrowserHistory, createMemoryHistory } from "@tanstack/history";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Reduz re-fetch redundante; mutações usam invalidateQueries (ignora staleTime).
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // NÃO re-tenta erros de auth/permissão/config — não são transientes. Antes,
        // um blip de auth virava ~3 tentativas com backoff (a UI parecia "travada").
        retry: (failureCount, error) => {
          const msg = error instanceof Error ? error.message : String(error);
          if (/unauthorized|forbidden|invalid token|missing supabase/i.test(msg)) return false;
          return failureCount < 2;
        },
      },
    },
  });
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  const history = isBrowser
    ? createBrowserHistory()
    : createMemoryHistory({ initialEntries: ["/"] });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history,
    scrollRestoration: isBrowser,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
