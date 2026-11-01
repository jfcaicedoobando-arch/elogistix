// Offline regressions. Run with `node --test scripts/ci/post-deploy-smoke.test.mjs`
// or the workflow's Deno command; no HTTP, credentials, or account mutations.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const test = globalThis.Deno?.test.bind(globalThis.Deno) ??
  (await import("node:test")).test;
const workflow = readFileSync(
  new URL("../../.github/workflows/post-deploy-smoke.yml", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");
const steps = workflow.split(/\n(?= {6}- (?:name:|uses:))/);
function step(name) {
  const matches = steps.filter((block) => block.startsWith(`      - name: ${name}\n`));
  assert.equal(matches.length, 1, `Expected one step: ${name}`);
  return matches[0];
}
const demo = step("Verify demo-access is disabled");
const report = step("Report credential-dependent checks as omitted");
const validator = demo.match(/<<'NODE'\n([\s\S]*?)^ {10}NODE$/m)?.[1];
assert.ok(validator, "The workflow must contain the actual response validator");
// Execute the workflow's own validator with an in-memory body and an exit trap.
// Only the mocked file reader is available through require; no request is sent.
const validate = new Function("require", "process", "console", validator);
function response(status, body) {
  const exitSignal = Symbol("exit");
  const messages = [];
  let exitCode = 0;
  let reads = 0;
  try {
    validate(
      (id) => {
        assert.equal(id, "node:fs");
        return { readFileSync: (path, encoding) => {
          assert.equal(path, "response.json");
          assert.equal(encoding, "utf8");
          reads += 1;
          return body;
        } };
      },
      { argv: ["node", "-", status, "response.json"], exit: (code) => {
        exitCode = code;
        throw exitSignal;
      } },
      { log: (message) => messages.push(message), error: (message) => messages.push(message) },
    );
  } catch (error) {
    if (error !== exitSignal) throw error;
  }
  assert.equal(reads, 1);
  return { exitCode, messages: messages.join("\n") };
}
const expected = JSON.stringify({ error: "demo_unavailable" });

test("503 succeeds only for the exact demo_unavailable object", () => {
  for (const payload of [expected, ' \n { "error": "demo_unavailable" } \n']) {
    const result = response("503", payload);
    assert.equal(result.exitCode, 0);
    assert.match(result.messages, /HTTP 503 demo_unavailable sin credenciales/);
  }
});


test("503 rejects duplicate members and escaped keys or values before declaring an exact body", () => {
  for (const payload of [
    '{"error":"canary-hidden-value","error":"demo_unavailable"}',
    '{"error":"demo_unavailable","error":"demo_unavailable"}',
    '{"error":"canary-hidden-value","\\u0065rror":"demo_unavailable"}',
    '{"\\u0065rror":"canary-hidden-value","error":"demo_unavailable"}',
    '{"\\u0065rror":"demo_unavailable"}',
    '{"error":"\\u0064emo_unavailable"}',
  ]) {
    const result = response("503", payload);
    assert.equal(result.exitCode, 1, "Noncanonical or duplicate member must fail");
    assert.doesNotMatch(result.messages, /canary-hidden-value/);
  }
});

test("503 permits JSON whitespace but rejects non-JSON whitespace and trailing content", () => {
  const spaced = ' \t\r\n{\t"error"\r\n:\t"demo_unavailable"\r\n}\t\r\n ';
  assert.equal(response("503", spaced).exitCode, 0);
  for (const whitespace of ["\u00a0", "\u2028", "\u2029", "\uFEFF", "\v", "\f"]) {
    assert.equal(response("503", whitespace + expected).exitCode, 1);
    assert.equal(response("503", expected + whitespace).exitCode, 1);
  }
  for (const suffix of ['{}', 'null', '// comment', 'canary-trailing-value']) {
    const result = response("503", expected + suffix);
    assert.equal(result.exitCode, 1);
    assert.doesNotMatch(result.messages, /canary-trailing-value/);
  }
});

test("503 rejects all additional fields, including message, data, debug and arbitrary strings", () => {
  for (const key of ["message", "data", "debug", "status", "note", "details", "result", "metadata", "x", "__proto__"]) {
    for (const value of ["canary-extra-value", "", null, true, 0, {}, [], { nested: "canary-extra-value" }, ["canary-extra-value"]]) {
      const extra = { [key]: value };
      for (const payload of [{ error: "demo_unavailable", ...extra }, { ...extra, error: "demo_unavailable" }]) {
        const result = response("503", JSON.stringify(payload));
        assert.equal(result.exitCode, 1, `Must reject extra field ${key}`);
        assert.doesNotMatch(result.messages, /canary-extra-value/);
      }
    }
  }
});

test("unexpected HTTP status fails even with the expected JSON", () => {
  for (const status of ["000", "200", "201", "204", "301", "400", "401", "403", "404", "410", "429", "500", "502", "504"]) {
    const result = response(status, expected);
    assert.equal(result.exitCode, 1, `HTTP ${status} must fail`);
    assert.match(result.messages, /^::error::/);
  }
});

test("503 rejects malformed JSON, scalars, arrays, and wrong or missing error", () => {
  for (const body of ["", "<html>Unavailable</html>", "{", "{}\n{}", "null", "true", "503", '"demo_unavailable"', "[]", '[{"error":"demo_unavailable"}]', "{}", '{"error":null}', '{"error":"unavailable"}', '{"error":"DEMO_UNAVAILABLE"}']) {
    assert.equal(response("503", body).exitCode, 1, `Must reject ${body}`);
  }
});

test("503 rejects credential fields even if null, nested, or inside an array", () => {
  for (const key of ["email", "password", "access_token", "refresh_token", "token", "credentials", "session", "secret", "authorization", "api_key", "apiKey", "PASSWORD", "userEmail"]) {
    for (const extra of [{ [key]: "canary-private-value" }, { data: { [key]: null } }, { data: [{ [key]: "canary-private-value" }] }]) {
      const result = response("503", JSON.stringify({ error: "demo_unavailable", ...extra }));
      assert.equal(result.exitCode, 1, `Must reject credential field ${key}`);
      assert.doesNotMatch(result.messages, /canary-private-value/);
    }
  }
});

test("unexpected response content is never written to the log", () => {
  for (const [status, body] of [["200", '{"email":"canary-email","password":"canary-password"}'], ["503", "canary-not-json"], ["503", '{"error":"canary-error"}']]) {
    const result = response(status, body);
    assert.equal(result.exitCode, 1);
    assert.doesNotMatch(result.messages, /canary/);
  }
  assert.doesNotMatch(demo, /\bcat\b|echo[^\n]*\$(?:PAYLOAD|BODY)|console\.(?:log|error)\(payload/);
});

test("curl captures the 503 status and body without treating expected 503 as transport failure", () => {
  const curl = demo.match(/STATUS=\$\(curl[\s\S]*?demo-access"\)/)?.[0];
  assert.ok(curl);
  assert.match(curl, /--connect-timeout 15 --max-time 45 -sS/);
  assert.match(curl, /-o "\$RESPONSE_FILE" -w "%\{http_code\}" -X POST/);
  assert.match(curl, /-d '\{\}'/);
  assert.doesNotMatch(curl, /--fail|-f\b|--retry|--location/);
  assert.match(demo, /set -euo pipefail/);
  assert.match(demo, /node --input-type=commonjs - "\$STATUS" "\$RESPONSE_FILE" <<'NODE'/);
  assert.match(demo, /trap 'rm -f "\$RESPONSE_FILE"' EXIT/);
  assert.doesNotMatch(demo, /GITHUB_ENV|GITHUB_OUTPUT|continue-on-error/);
});

test("independent pings remain reachable after a failed demo or prior ping", () => {
  for (const name of ["Ping exchange-rates", "Ping tracking-public (token inexistente debe responder 404/410)"]) {
    const ping = step(name);
    assert.match(ping, /if: \$\{\{ !cancelled\(\) && env\.SUPABASE_URL != '' && env\.ANON_KEY != '' \}\}/);
    assert.doesNotMatch(ping, /success\(\)|DEMO_|continue-on-error/);
    assert.match(ping, /Authorization: Bearer \$\{ANON_KEY\}/);
  }
  assert.match(step("Ping exchange-rates"), /test "\$STATUS" = "200"/);
  assert.match(step("Ping tracking-public (token inexistente debe responder 404/410)"), /"\$STATUS" != "404".*"\$STATUS" != "410".*"\$STATUS" != "400"/);
});

test("credential-dependent checks are explicitly omitted in notices and summary", () => {
  assert.match(report, /if: \$\{\{ !cancelled\(\) \}\}/);
  assert.match(report, /::notice::OMITIDOS/);
  assert.match(report, /GITHUB_STEP_SUMMARY/);
  for (const omitted of ["user-management/smoke_test.ts", "duplicar_cotizacion", "cxc_aging_clientes", "Soft delete"]) {
    assert.ok(report.includes(omitted), `Must report omission: ${omitted}`);
  }
  assert.match(report, /Esta ejecución no valida esas operaciones autenticadas/);
  assert.doesNotMatch(report, /curl|deno test|node |\bPATCH\b/);
});

test("there is no login, authenticated RPC, credential export, or alternate user provisioning", () => {
  const executableSteps = steps.filter((block) => block !== report).join("\n");
  assert.doesNotMatch(executableSteps, /DEMO_USER_|DEMO_TOKEN|\/auth\/v1\/|grant_type|\/rest\/v1\/|user-management\/smoke_test\.ts|service_role|SERVICE_ROLE|admin\.createUser|signInWithPassword|provision-users|seed-demo/);
  assert.deepEqual([...workflow.matchAll(/\$\{SUPABASE_URL\}([^"\s]+)/g)].map((match) => match[1]), [
    "/functions/v1/demo-access",
    "/functions/v1/exchange-rates",
    "/functions/v1/tracking-public?token=smoke-no-existe-xyz",
  ]);
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test("manual trigger, read-only permission, concurrency, runner and checkout protections remain", () => {
  assert.match(workflow, /^on:\n {2}workflow_dispatch:\n\npermissions:\n {2}contents: read\n/m);
  assert.match(workflow, /^concurrency:\n {2}group: post-deploy-smoke\n {2}cancel-in-progress: false$/m);
  assert.match(workflow, /runs-on: ubuntu-24\.04\n {4}timeout-minutes: 15/);
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(workflow, /persist-credentials: false/);
  assert.deepEqual([...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map((match) => match[1]), ["SUPABASE_URL", "SUPABASE_ANON_KEY"]);
});

test("Deno executes only these offline regressions with sanitizers and no network permission", () => {
  const local = step("Run demo-disabled smoke contract regressions (local only)");
  assert.match(workflow, /denoland\/setup-deno@22d081ff2d3a40755e97629de92e3bcbfa7cf2ed/);
  assert.match(workflow, /deno-version: v2\.9\.8/);
  assert.match(local, /DENO_NO_PACKAGE_JSON: "1"/);
  for (const flag of ["--sanitize-ops", "--sanitize-resources", "--node-modules-dir=none", "--allow-read"]) {
    assert.ok(local.includes(flag));
  }
  assert.match(local, /scripts\/ci\/post-deploy-smoke\.test\.mjs/);
  assert.doesNotMatch(local, /--allow-net|--allow-env|--allow-run|--allow-all|--no-check|--no-sanitize|VITE_SUPABASE|DEMO_/);
});
