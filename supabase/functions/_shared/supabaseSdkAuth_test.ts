/** Real Supabase/Auth SDK contracts; run without --allow-net after caching. */
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  FACTOR_ID, jsonResponse, offlineTest, SDK_KEY, sdkFixture, USER_ID,
} from "./supabaseSdkContract.ts";

const INVALID_IDS = [
  "", "../logout", "../../admin/users", "%2e%2e%2flogout", "not-a-uuid",
  `${USER_ID}/../logout`, `${USER_ID}?redirect_to=/logout`, `${USER_ID}#fragment`,
  ` ${USER_ID}`, `${USER_ID}\n`, `${USER_ID}\u0000`,
];

const operations = ["get", "update", "delete", "list-factors", "delete-factor-user", "delete-factor-id"] as const;
for (const operation of operations) {
  offlineTest(`Supabase SDK: ${operation} rejects malformed UUIDs before fetch`, async () => {
    const { client, requests } = sdkFixture(() => {
      throw new Error("Malformed identifiers must not reach the transport");
    });
    for (const id of INVALID_IDS) {
      const call = () => {
        switch (operation) {
          case "get": return client.auth.admin.getUserById(id);
          case "update": return client.auth.admin.updateUserById(id, { ban_duration: "none" });
          case "delete": return client.auth.admin.deleteUser(id);
          case "list-factors": return client.auth.admin.mfa.listFactors({ userId: id });
          case "delete-factor-user": return client.auth.admin.mfa.deleteFactor({ userId: id, id: FACTOR_ID });
          case "delete-factor-id": return client.auth.admin.mfa.deleteFactor({ userId: USER_ID, id });
        }
      };
      await assertRejects(call, Error, "Expected parameter to be UUID");
      assertEquals(requests.length, 0, `${operation}: ${JSON.stringify(id)}`);
    }
  });
}

for (const id of [USER_ID, USER_ID.toUpperCase()]) {
  for (const operation of ["get", "update", "delete"] as const) {
    offlineTest(`Supabase SDK: ${operation} accepts complete UUID ${id}`, async () => {
      const { client, requests } = sdkFixture(() => jsonResponse({ id }));
      const result = operation === "get" ? await client.auth.admin.getUserById(id)
        : operation === "update" ? await client.auth.admin.updateUserById(id, { ban_duration: "none" })
        : await client.auth.admin.deleteUser(id);
      assertEquals(result.error, null);
      assertEquals(result.data.user?.id, id);
      assertEquals(requests.length, 1);
      const [request] = requests;
      assertEquals(request.url.origin, "https://sdk-contract.invalid");
      assertEquals(request.url.pathname, `/auth/v1/admin/users/${id}`);
      assertEquals(request.url.search, "");
      assertEquals(request.method, { get: "GET", update: "PUT", delete: "DELETE" }[operation]);
      assertEquals(request.headers.get("apikey"), SDK_KEY);
      assertEquals(request.headers.get("Authorization"), `Bearer ${SDK_KEY}`);
      if (operation === "update") assertEquals(JSON.parse(request.body), { ban_duration: "none" });
      if (operation === "delete") assertEquals(JSON.parse(request.body), { should_soft_delete: false });
    });
  }
}

offlineTest("Supabase SDK: MFA accepts uppercase user/factor UUIDs on the intended path", async () => {
  const userId = USER_ID.toUpperCase();
  const factorId = FACTOR_ID.toUpperCase();
  const { client, requests } = sdkFixture((request) =>
    jsonResponse(request.method === "GET" ? [{ id: factorId }] : { id: factorId })
  );
  const listed = await client.auth.admin.mfa.listFactors({ userId });
  assertEquals(listed.error, null);
  assertEquals(listed.data?.factors.map((factor) => factor.id), [factorId]);
  const deleted = await client.auth.admin.mfa.deleteFactor({ userId, id: factorId });
  assertEquals(deleted.error, null);
  assertEquals(requests.map((request) => [request.method, request.url.pathname]), [
    ["GET", `/auth/v1/admin/users/${userId}/factors`],
    ["DELETE", `/auth/v1/admin/users/${userId}/factors/${factorId}`],
  ]);
});

offlineTest("Supabase SDK: getUser sends the supplied caller token and maps Auth errors", async () => {
  const { client, requests } = sdkFixture((request) => request.headers.get("Authorization") === "Bearer caller-token"
    ? jsonResponse({ id: USER_ID }) : jsonResponse({ msg: "access denied" }, 403)
  );
  const accepted = await client.auth.getUser("caller-token");
  assertEquals(accepted.error, null);
  assertEquals(accepted.data.user?.id, USER_ID);
  assertEquals(requests[0].url.pathname, "/auth/v1/user");
  assertEquals(requests[0].method, "GET");
  assertEquals(requests[0].headers.get("apikey"), SDK_KEY);
  const rejected = await client.auth.getUser("rejected-token");
  assertEquals(rejected.data.user, null);
  assertEquals(rejected.error?.status, 403);
  assertEquals(requests.length, 2);
});
