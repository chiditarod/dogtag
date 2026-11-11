import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { BASENAME, routes } from '@/app/router';
import { queryConfig } from '@/lib/react-query';

/** Renders the real route tree in a memory router + fresh QueryClient. */
export function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(routes, {
    basename: BASENAME,
    initialEntries: [`${BASENAME}${path}`],
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}
