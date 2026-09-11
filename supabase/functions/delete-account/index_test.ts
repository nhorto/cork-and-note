// Account deletion has one invariant: every step succeeds before the next
// runs, so a failure leaves the account intact and retryable rather than
// half-deleted. The order is storage objects, then database rows as the
// user, then the auth user through the admin API.
import { assertEquals } from "jsr:@std/assert";
import { createHandler } from "./index.ts";
import { fakeDeps, jsonRequest, readJson } from "../_shared/testing.ts";

const USER = { id: "00000000-0000-4000-8000-000000000007", email: "a@example.com" };
const FAILED = { error: "Account deletion failed. Please try again." };

function setup({ user = USER as typeof USER | null, objects = [] as { bucket_id: string; name: string }[] } = {}) {
  const f = fakeDeps({ user });
  f.admin.rpcResponders.list_user_storage_objects = () => ({ data: objects, error: null });
  for (const o of objects) (f.admin.storageObjects[o.bucket_id] ??= []).push(o.name);
  f.db.rpcResponders.delete_user_data = () => ({ data: null, error: null });
  return { ...f, handler: createHandler(f.deps) };
}

const del = (auth = "Bearer jwt") => jsonRequest({}, { auth, url: "https://edge.test/delete-account" });

Deno.test("only POST is accepted; OPTIONS is a preflight", async () => {
  const { handler } = setup();
  assertEquals((await handler(new Request("https://edge.test/d", { method: "OPTIONS" }))).status, 200);
  const res = await handler(new Request("https://edge.test/d", { method: "GET", headers: { Authorization: "Bearer x" } }));
  assertEquals(res.status, 405);
});

Deno.test("no token or an invalid token is 401 and nothing is touched", async () => {
  for (const [auth, user] of [["", USER], ["Bearer bad", null]] as const) {
    const { handler, admin, db } = setup({ user });
    const res = await handler(del(auth));
    assertEquals(res.status, 401);
    assertEquals(admin.rpcCalls.length, 0);
    assertEquals(db.rpcCalls.length, 0);
    assertEquals(admin.deletedUsers, []);
  }
});

Deno.test("the happy path removes storage in batches of 100 per bucket, then rows as the user, then the auth user", async () => {
  const objects = [
    ...Array.from({ length: 150 }, (_, i) => ({ bucket_id: "wine-photos", name: `wine_${USER.id}_${i}.jpg` })),
    { bucket_id: "visit-photos", name: `visit_${USER.id}_1.jpg` },
  ];
  const { handler, admin, db } = setup({ objects });
  const res = await handler(del());
  assertEquals(res.status, 200);
  assertEquals(await readJson(res), { success: true });

  // 1. Storage enumerated for THIS user, through the service role.
  assertEquals(admin.rpcCalls, [{ name: "list_user_storage_objects", args: { p_user_id: USER.id } }]);
  const removes = admin.storageCalls.filter((c) => c.op === "remove");
  assertEquals(removes.map((c) => [c.bucket, (c.args as string[]).length]), [["wine-photos", 100], ["wine-photos", 50], ["visit-photos", 1]]);
  assertEquals(admin.storageObjects["wine-photos"], []);
  assertEquals(admin.storageObjects["visit-photos"], []);

  // 2. Rows deleted AS THE CALLER, so the RPC scopes itself to auth.uid().
  assertEquals(db.rpcCalls, [{ name: "delete_user_data", args: undefined }]);
  // 3. The auth user last.
  assertEquals(admin.deletedUsers, [USER.id]);
});

Deno.test("a user with no photos still has rows and the auth user deleted", async () => {
  const { handler, admin, db } = setup();
  assertEquals((await handler(del())).status, 200);
  assertEquals(admin.storageCalls.length, 0);
  assertEquals(db.rpcCalls.length, 1);
  assertEquals(admin.deletedUsers, [USER.id]);
});

Deno.test("a failed storage listing stops before anything is deleted", async () => {
  const { handler, admin, db } = setup();
  admin.rpcResponders.list_user_storage_objects = () => ({ data: null, error: { message: "rpc missing" } });
  const res = await handler(del());
  assertEquals(res.status, 500);
  assertEquals(await readJson(res), FAILED);
  assertEquals(admin.storageCalls.length, 0);
  assertEquals(db.rpcCalls.length, 0);
  assertEquals(admin.deletedUsers, []);
});

Deno.test("a failed storage removal stops before rows or the auth user are touched", async () => {
  const { handler, admin, db } = setup({ objects: [{ bucket_id: "wine-photos", name: "a.jpg" }] });
  admin.storageRemoveError = { message: "storage down" };
  const res = await handler(del());
  assertEquals(res.status, 500);
  assertEquals(await readJson(res), FAILED);
  assertEquals(db.rpcCalls.length, 0);
  assertEquals(admin.deletedUsers, []);
});

Deno.test("a failed row deletion leaves the auth user in place so the account can retry", async () => {
  const { handler, admin, db } = setup();
  db.rpcResponders.delete_user_data = () => ({ data: null, error: { message: "fk violation" } });
  const res = await handler(del());
  assertEquals(res.status, 500);
  assertEquals(await readJson(res), FAILED);
  assertEquals(admin.deletedUsers, []);
});

Deno.test("a failed auth deletion is reported as a failure, not a success with a ghost login", async () => {
  const { handler, admin } = setup();
  admin.adminDeleteError = { message: "auth api 500" };
  const res = await handler(del());
  assertEquals(res.status, 500);
  assertEquals(await readJson(res), FAILED);
});

Deno.test("an unexpected throw is the same generic failure, with nothing leaked", async () => {
  const { handler, admin } = setup();
  admin.rpcResponders.list_user_storage_objects = () => { throw new Error("boom: internal path"); };
  const res = await handler(del());
  assertEquals(res.status, 500);
  assertEquals(await readJson(res), FAILED);
});
