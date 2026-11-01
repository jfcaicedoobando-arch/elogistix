import assert from "node:assert/strict";
import * as React from "npm:react@18.3.1";
// Preserve the renderer's existing React 18 peer, independently of the frontend.
import * as ReactDOM from "npm:react-dom@18.3.1";
import snapshots from "./sdk_snapshots.json" with { type: "json" };

import {
  ACTIONS,
  API_KEY,
  CONFIRM_URL,
  EMAIL,
  event,
  isolated,
  sha256,
  signedRequest,
  TOKEN,
} from "./sdkTestHarness.ts";

for (const action of ACTIONS) {
  Deno.test(`auth SDK: signed ${action} preserves baseline HTML/text and send contract`, async () => {
    await isolated(async (handle, sends) => {
      assert.equal(React.version, "18.3.1");
      assert.equal(ReactDOM.version, "18.3.1");
      const response = await handle(await signedRequest(event(action)));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { success: true, sent: true });
      assert.equal(sends.length, 1);
      const { headers, body } = sends[0];
      assert.equal(headers.get("Authorization"), `Bearer ${API_KEY}`);
      assert.equal(headers.get("Content-Type"), "application/json");
      assert.equal(headers.get("Idempotency-Key"), `offline-${action}`);
      assert.deepEqual(Object.keys(body).sort(), [
        "from",
        "html",
        "label",
        "purpose",
        "run_id",
        "sender_domain",
        "subject",
        "text",
        "to",
      ]);
      assert.equal(body.run_id, `offline-${action}`);
      assert.equal(body.to, EMAIL);
      assert.equal(body.from, "Libre Carga <noreply@librecarga.com>");
      assert.equal(body.sender_domain, "notify.librecarga.com");
      assert.equal(body.purpose, "transactional");
      assert.equal(body.label, action);
      const html = String(body.html);
      const text = String(body.text);
      assert.match(html, /<html[^>]*lang="es"/);
      assert.ok(text.length > 50);
      if (action === "reauthentication") {
        assert.ok(html.includes(TOKEN));
        assert.ok(text.includes(TOKEN));
      } else {
        assert.ok(html.includes(CONFIRM_URL.replaceAll("&", "&amp;")));
        assert.ok(text.includes(CONFIRM_URL));
      }
      if (action === "email_change") {
        assert.ok(text.includes("old@example.test"));
        assert.ok(text.includes("new@example.test"));
      }
      const expected = snapshots.auth[action];
      assert.equal(body.subject, expected.subject);
      assert.equal(await sha256(html), expected.htmlSha256);
      assert.equal(await sha256(text), expected.textSha256);
    });
  });

  Deno.test(`auth preview: ${action} renders its baseline HTML with zero sends`, async () => {
    await isolated(async (handle, sends) => {
      const response = await handle(
        new Request("https://auth-hook.invalid/preview", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: action }),
        }),
      );
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get("Content-Type"),
        "text/html; charset=utf-8",
      );
      assert.equal(
        await sha256(await response.text()),
        snapshots.auth[action].previewHtmlSha256,
      );
      assert.equal(sends.length, 0);
    });
  });
}

Deno.test("auth SDK: retries preserve the run id and idempotency header", async () => {
  await isolated(async (handle, sends) => {
    const request = await signedRequest(
      event("signup", "offline-replayed-run"),
    );
    for (const replay of [request.clone(), request]) {
      const response = await handle(replay);
      assert.equal(response.status, 200);
      await response.body?.cancel();
    }
    assert.equal(sends.length, 2);
    assert.equal(
      sends[0].headers.get("Idempotency-Key"),
      "offline-replayed-run",
    );
    assert.equal(
      sends[1].headers.get("Idempotency-Key"),
      "offline-replayed-run",
    );
    assert.deepEqual(sends[0].body, sends[1].body);
  });
});

Deno.test("auth SDK 0.6: unsupported action identifies the supported existing actions", async () => {
  await isolated(async (handle, sends) => {
    const response = await handle(await signedRequest(event("unconfigured")));
    assert.equal(response.status, 400);
    // SDK 0.6 adds structured diagnostics; the rejection remains permanent.
    assert.deepEqual(await response.json(), {
      error: "unsupported_action_type",
      action_type: "unconfigured",
      supported_action_types: [...ACTIONS],
    });
    assert.equal(sends.length, 0);
  });
});

Deno.test("auth SDK: invalid signature and missing/invalid/stale timestamps cannot send", async (test) => {
  const now = Math.floor(Date.now() / 1000);
  const cases: Array<[string, () => Promise<Request>]> = [
    [
      "wrong secret",
      () => signedRequest(event("signup"), { secret: "wrong-offline-secret" }),
    ],
    [
      "invalid signature",
      () => signedRequest(event("signup"), { signature: "sha256=invalid" }),
    ],
    ["missing signature", async () => {
      const request = await signedRequest(event("signup"));
      request.headers.delete("x-lovable-signature");
      return request;
    }],
    ["missing timestamp", async () => {
      const request = await signedRequest(event("signup"));
      request.headers.delete("x-lovable-timestamp");
      return request;
    }],
    [
      "invalid timestamp",
      () => signedRequest(event("signup"), { timestamp: "invalid" }),
    ],
    [
      "expired timestamp",
      () => signedRequest(event("signup"), { timestamp: String(now - 3600) }),
    ],
    [
      "future timestamp",
      () => signedRequest(event("signup"), { timestamp: String(now + 3600) }),
    ],
  ];
  for (const [name, request] of cases) {
    await test.step(name, async () => {
      await isolated(async (handle, sends) => {
        const response = await handle(await request());
        assert.equal(response.status, 401);
        await response.body?.cancel();
        assert.equal(sends.length, 0);
      });
    });
  }
});

Deno.test("auth SDK: permanent errors return 400; retryable and network failures return 500", async (test) => {
  for (
    const [status, expected] of [[400, 400], [401, 400], [429, 500], [500, 500]]
  ) {
    await test.step(`send status ${status}`, async () => {
      await isolated(async (handle, sends) => {
        const response = await handle(await signedRequest(event("recovery")));
        assert.equal(response.status, expected);
        assert.deepEqual(await response.json(), {
          error: expected === 400
            ? "Email send rejected"
            : "Failed to send email",
        });
        assert.equal(sends.length, 1);
      }, () => Response.json({ type: "offline_failure" }, { status }));
    });
  }
  await test.step("network failure", async () => {
    await isolated(async (handle, sends) => {
      const response = await handle(await signedRequest(event("recovery")));
      assert.equal(response.status, 500);
      await response.body?.cancel();
      assert.equal(sends.length, 1);
    }, () => {
      throw new TypeError("offline network failure");
    });
  });
});

Deno.test("auth preview: authorization, invalid requests and preflight never send", async (test) => {
  const cases: Array<[string, Request, number]> = [
    [
      "unauthorized",
      new Request("https://auth-hook.invalid/preview", {
        method: "POST",
        body: "{}",
      }),
      401,
    ],
    [
      "invalid JSON",
      new Request("https://auth-hook.invalid/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` },
        body: "{",
      }),
      400,
    ],
    [
      "unknown template",
      new Request("https://auth-hook.invalid/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` },
        body: '{"type":"unknown"}',
      }),
      400,
    ],
    [
      "preflight",
      new Request("https://auth-hook.invalid/preview", { method: "OPTIONS" }),
      200,
    ],
  ];
  for (const [name, request, expected] of cases) {
    await test.step(name, async () => {
      await isolated(async (handle, sends) => {
        const response = await handle(request);
        assert.equal(response.status, expected);
        await response.body?.cancel();
        assert.equal(sends.length, 0);
      });
    });
  }
});
