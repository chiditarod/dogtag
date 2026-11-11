import { setupServer } from 'msw/node';

// Handlers are added per-test (server.use) or by later feature tasks.
export const server = setupServer();
