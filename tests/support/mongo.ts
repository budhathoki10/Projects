import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * A real MongoDB for tests. Set TEST_MONGODB_URI to use one you already run (the tests wipe
 * the database they are given, so never point it at real data); otherwise a throwaway
 * mongod is started on a free port and removed afterwards.
 */
export async function startMongo(): Promise<{ uri: string; stop: () => Promise<void> }> {
  const given = process.env.TEST_MONGODB_URI;
  if (given) return { uri: given, stop: async () => {} };
  const server = await MongoMemoryServer.create();
  return {
    uri: server.getUri(),
    stop: async () => {
      await server.stop();
    },
  };
}
