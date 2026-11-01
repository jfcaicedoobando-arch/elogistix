import assert from "node:assert/strict";
import { createRequire } from "node:module";
import net from "node:net";
import test from "node:test";
import postgres from "postgres";

const require = createRequire(import.meta.url);
const config = {
  host: "127.0.0.1", port: 1, database: "synthetic", user: "synthetic",
  password: "", ssl: false, max: 1, fetch_types: false,
};

// Loader and construction contracts only: no query, migration or database.
test("Postgres loaders and Drizzle clients construct without opening sockets", async (t) => {
  const originalConnect = net.Socket.prototype.connect;
  const clients = [];
  let attempts = 0;
  net.Socket.prototype.connect = function () {
    attempts += 1;
    throw new Error("Network forbidden in offline loader contracts");
  };
  t.after(async () => {
    try {
      await Promise.all(clients.map((client) => client.end({ timeout: 0 })));
      assert.equal(attempts, 0, "Imports and construction must remain offline");
    } finally {
      net.Socket.prototype.connect = originalConnect;
    }
  });
  const clientFrom = (factory) => {
    const client = factory({ ...config });
    clients.push(client);
    return client;
  };

  await t.test("root ESM default import constructs the standalone fixture client", () => {
    assert.equal(typeof postgres, "function");
    const client = clientFrom(postgres);
    assert.equal(client.options.max, 1);
    assert.equal(typeof client.unsafe, "function");
    assert.equal(typeof client.begin, "function");
  });

  await t.test("dynamic import and explicit CommonJS default resolve the same factory", async () => {
    const dynamic = await import("postgres");
    const commonjs = require("postgres");
    assert.equal(dynamic.default, postgres);
    assert.equal(commonjs.default, postgres);
    clientFrom(dynamic.default);
    clientFrom(commonjs.default);
  });

  await t.test("Drizzle Kit's dynamic imports and transparent parser overrides construct", async () => {
    const driver = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = clientFrom(driver.default);
    const transparent = (value) => value;
    for (const type of ["1184", "1082", "1083", "1114"]) {
      client.options.parsers[type] = transparent;
      client.options.serializers[type] = transparent;
    }
    client.options.serializers["114"] = transparent;
    client.options.serializers["3802"] = transparent;
    assert.equal(drizzle(client).$client, client);
    assert.equal(typeof migrate, "function"); // Import only; never call the migrator.
    for (const type of ["1184", "1082", "1083", "1114", "1182", "1185", "1115", "1231"]) {
      assert.equal(client.options.parsers[type]("unchanged"), "unchanged");
      assert.equal(client.options.serializers[type]("unchanged"), "unchanged");
    }
    assert.equal(client.options.serializers["114"]("{}"), "{}");
    assert.equal(client.options.serializers["3802"]("{}"), "{}");
  });

  await t.test("Drizzle ESM and CommonJS accept explicitly constructed clients", async () => {
    const esm = await import("drizzle-orm/postgres-js");
    const commonjs = require("drizzle-orm/postgres-js");
    for (const orm of [esm, commonjs]) {
      const client = clientFrom(postgres);
      assert.equal(orm.drizzle({ client }).$client, client);
    }
  });
});
