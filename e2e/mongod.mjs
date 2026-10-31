// A throwaway MongoDB for the browser tests, on a fixed port so Playwright can wait for it.
import { MongoMemoryServer } from "mongodb-memory-server";

const port = Number(process.env.E2E_MONGO_PORT ?? 27018);
const server = await MongoMemoryServer.create({ instance: { port } });
console.log(`MongoDB for tests on ${server.getUri()}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.stop().finally(() => process.exit(0)));
