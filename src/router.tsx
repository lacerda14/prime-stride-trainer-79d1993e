import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createBrowserHistory, createMemoryHistory } from "@tanstack/history";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const history = isBrowser
    ? createBrowserHistory()
    : createMemoryHistory({ initialEntries: ['/'] });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history,
    scrollRestoration: isBrowser,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
