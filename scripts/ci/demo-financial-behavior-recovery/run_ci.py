#!/usr/bin/env python3
"""Actions-only synthetic financial behavior; exact PR353 catalog, no live mode."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import signal
import subprocess
import sys
import uuid
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
COMPILE = ROOT / "scripts/ci/demo-financial-compile-recovery"
COMPILE_SHA = "c3a593c94f236aab01c887728c07748eb6912cae"
BASE_BRANCH = "main"
EVENT_BASE = "b66d2c2caa00d7a8d522ed7140b6a15877a0b2aa"
BRANCH = "codex/demo-financial-behavior-recovery-20261015"
REPOSITORY = "jfcaicedoobando-arch/elogistix"
DATABASE = "demo_financial_compile_recovery_lab"
INFRA = ROOT / "scripts/ci/crm-acl-review/run_ci.py"
INFRA_SHA = "a364f833851080d9b290fca35fa7925514dc898979359e55c411f0eef57e7816"
FAULT_SUITES = ("checkpoint", "marker", "execution_receipt", "event", "receipt")
SUITES = ("happy", *FAULT_SUITES, "retry_security")
PROPOSALS = ("original", "retry-corrected")

def require(value, message):
    if not value:
        raise RuntimeError(message)

def sha(body):
    return hashlib.sha256(body).hexdigest()

def file_bytes(path):
    body = path.read_bytes()
    return body.replace(b"\r\n", b"\n") if os.name == "nt" else body

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result

def inventory(directory, rows):
    frozen = {}
    for row in rows:
        require(set(row) == {"path", "bytes", "sha256"}, "Malformed inventory")
        rel = row["path"]
        require(isinstance(rel, str) and rel and "\\" not in rel and ":" not in rel
                and not PurePosixPath(rel).is_absolute() and all(p not in ("", ".", "..") for p in rel.split("/"))
                and rel not in frozen, "Unsafe inventory path")
        path = directory / rel
        require(path.is_file() and directory in path.resolve().parents
                and not any(p.is_symlink() for p in (path, *path.parents) if directory in p.parents), "Missing or symlink input")
        body = file_bytes(path)
        require(type(row["bytes"]) is int and len(body) == row["bytes"] and sha(body) == row["sha256"], "Source drift: " + rel)
        frozen[rel] = body
    require(frozen, "Empty inventory")
    return frozen

def verify_inputs():
    rows = json.loads((HERE / "inputs.json").read_text())
    frozen = inventory(HERE, rows)
    actual = set()
    for p in HERE.rglob("*"):
        require(not p.is_symlink(), "Symlink member")
        if p.is_file():
            actual.add(p.relative_to(HERE).as_posix())
    require(actual == set(frozen) | {"inputs.json"}, "Incomplete behavior inventory")
    pins = json.loads(frozen["source-pins.json"])
    require(pins["compile_commit"] == COMPILE_SHA and pins["source_base"] == "025270cadcee0cedef64aab31be93eb0ff3f0288"
            and pins["reference_commit"] == "e8d45165216403478f144f75437fa8c4c6116b5b", "Provenance differs")
    pinned_compile = inventory(ROOT, pins["compile_sources"])
    actual_compile = {p.relative_to(ROOT).as_posix() for p in COMPILE.rglob("*") if p.is_file()}
    require(actual_compile == set(pinned_compile), "Compile milestone inventory changed")
    for row in pins["references"]:
        body = frozen[row["path"]]
        require(len(body) == row["bytes"] and sha(body) == row["sha256"], "Reference changed")
    require(sha(file_bytes(INFRA)) == INFRA_SHA, "Golden infrastructure changed")
    return frozen, pins

def laboratory_manifest(original):
    """Explicit synthetic variant: three fixture expedientes and derived digest only."""
    require(sha(original) == "be3e506d347121bba52fd4bb14ea3d5d5984bde51f720185a5054c2a63ecef63", "Original manifest differs")
    body = original
    changes = []
    for n in (1, 2, 3):
        old = ('"shipmentExpediente":"SYNTHETIC-SHIPMENT-' + str(n) + '"').encode()
        new = ('"shipmentExpediente":"DEMO-2026-' + str(n) + '"').encode()
        require(body.count(old) == 1, "Expected unique fixture expediente")
        body = body.replace(old, new)
        changes.append({"field": "fixtures[" + str(n - 1) + "].shipmentExpediente", "before": "SYNTHETIC-SHIPMENT-" + str(n), "after": "DEMO-2026-" + str(n)})
    match = re.search(rb"\$manifest\$(.*?)\$manifest\$", body, re.S)
    require(match is not None, "Manifest JSON missing")
    derived = sha(match.group(1))
    declared = b"fc42f6ecf31d771c6d918e25e1eff3e113e285987e17db19799684156f67fe99"
    require(body.count(declared) == 1, "Declared source digest differs")
    body = body.replace(declared, derived.encode())
    return body, {"scope": "EXPLICIT_SYNTHETIC_LAB_VARIANT_NOT_ORIGINAL_MANIFEST", "source_path": "scripts/ci/demo-financial-compile-recovery/upstream/flow/sql/02-manifest.sql",
                  "source_commit": COMPILE_SHA, "source_sha256": sha(original), "variant_sha256": sha(body),
                  "changes": changes, "original_declared_manifest_digest": declared.decode(), "variant_derived_json_digest": derived,
                  "digest_rule": "SHA256 of exact embedded UTF8 JSON bytes after three fixture substitutions"}

def function_body(body):
    declaration = re.search(rb"CREATE(?: OR REPLACE)? FUNCTION demo_flow_writer\.prepare_authorized_run\(p_context_id uuid\).*?AS (\$[a-zA-Z_]*\$)(.*?)\1;", body, re.S)
    require(declaration is not None, "Proposed function body missing")
    return declaration.group(2)

def correction_input(frozen, compile_frozen):
    original = compile_frozen["upstream/flow/issuer/10-issuer.sql"]
    patch = frozen["sql/replay-correction.sql"]
    old_hash, new_hash = sha(function_body(original)), sha(function_body(patch))
    require(old_hash != new_hash, "Correction must differ explicitly")
    def check(expected):
        return ("DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='demo_flow_writer.prepare_authorized_run(uuid)'::regprocedure "
                "AND proowner=current_user::regrole::oid AND NOT prosecdef AND prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql') "
                "AND proconfig=ARRAY['search_path=pg_catalog'] AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='" + expected + "') "
                "THEN RAISE EXCEPTION 'PROPOSED_RETRY_CORRECTION_SOURCE_CONFLICT'; END IF; END $guard$;\n").encode()
    installed = check(old_hash) + patch + b"\n" + check(new_hash) + b"SELECT 'FINANCIAL_PROPOSED_RETRY_CORRECTION_VERIFIED';\n"
    return installed, {"scope": "ISOLATED_PROPOSED_SAME_CONTEXT_RETRY_CORRECTION_NOT_HISTORICAL_SOURCE", "source_commit": COMPILE_SHA,
                       "source_path": "scripts/ci/demo-financial-compile-recovery/upstream/flow/issuer/10-issuer.sql",
                       "source_sha256": sha(original), "source_function_body_sha256": old_hash,
                       "correction_path": "sql/replay-correction.sql", "correction_sha256": sha(patch),
                       "corrected_function_body_sha256": new_hash, "installed_stdin_sha256": sha(installed),
                       "new_purpose_replay_adapter": "HOLD_UNCHANGED"}

def gate(event, env, head):
    require(env.get("GITHUB_ACTIONS") == "true", "Actions only; local SQL/Docker forbidden")
    require(env.get("GITHUB_EVENT_NAME") == "pull_request" and env.get("GITHUB_REPOSITORY") == REPOSITORY, "Owned PR event required")
    require(event["action"] in ("opened", "synchronize", "reopened") and event["repository"]["full_name"] == REPOSITORY, "Event mismatch")
    pr = event["pull_request"]
    for side in ("head", "base"):
        require(pr[side]["repo"]["full_name"] == REPOSITORY and pr[side]["repo"]["owner"]["login"] == "jfcaicedoobando-arch", "Foreign repository")
    require(pr["draft"] is True and pr["head"]["ref"] == BRANCH, "Exact draft branch required")
    require(pr["base"]["ref"] == BASE_BRANCH and pr["base"]["sha"] == EVENT_BASE, "Reviewed event base changed; explicit review required")
    require(re.fullmatch("[0-9a-f]{40}", head) and head == pr["head"]["sha"], "Exact head required")

def expand_sql(frozen, path, stack=()):
    require(path in frozen and path.startswith("sql/") and path not in stack, "Unknown or recursive SQL include")
    lines = []
    for line in frozen[path].decode().splitlines():
        if line.lstrip().startswith("\\ir"):
            require(line.strip() in ("\\ir assertions.sql", "\\ir fault.sql"), "Unapproved SQL include")
            target = "sql/" + line.strip().split()[1]
            lines.append(expand_sql(frozen, target, (*stack, path)).decode())
        else:
            lines.append(line)
    return ("\n".join(lines) + "\n").encode()

def suite_sql(frozen, suite):
    require(suite in SUITES, "Unknown suite")
    body = b""
    for name in ("fixture", "prepare-context", "assertions", suite):
        body += ("\n\\echo FINANCIAL_PHASE_" + name.replace("-", "_") + "\n").encode()
        body += expand_sql(frozen, "sql/" + name + ".sql")
    return body

def diagnose(stdout, stderr, fallback, exit_code):
    error = (stdout + stderr).decode("utf-8", errors="replace")
    phases = re.findall(r"^FINANCIAL_PHASE_([a-z_]+)$", stdout.decode("utf-8", errors="replace"), re.M)
    lines = [line[:500] for line in error.splitlines() if re.search(r"ERROR:|LINE [0-9]+:|CONTEXT:", line)]
    return {"exit_code": exit_code, "phase": phases[-1] if phases else fallback,
            "sqlstate": next(iter(re.findall(r"ERROR:\s+([0-9A-Z]{5}):", error)), None), "lines": lines[:8]}

def cleanup_ok(result):
    return (result.get("cleanup") == "confirmed_stopped_and_removed" and result.get("shutdown_confirmed") is True
            and result.get("pg_status_3_and_no_pid") is True and result.get("owned_psql_clients_closed") is True)

def case_summary(result, suite, successful, expected, proposal="original"):
    stages = result.get("stages", [])
    installed = [r.get("stage") for r in stages[:len(expected)]] == expected and all(r.get("status") == "PASS" for r in stages[:len(expected)])
    correction_stage = ["proposed-same-context-retry-correction"] if proposal == "retry-corrected" else []
    all_stages = [r.get("stage") for r in stages] == [*expected, *correction_stage, "synthetic-boundary-privileges", "behavior-" + suite] and all(r.get("status") == "PASS" for r in stages)
    accepted = successful and installed and all_stages and cleanup_ok(result) and result.get("suite_markers") is True and (suite not in FAULT_SUITES or result.get("injection_observed") is True)
    return {"suite": suite, "status": "PASS" if accepted else "FAIL", "catalog_compile": "PASS" if installed else "FAIL",
            "financial_behavior": "PASS" if accepted else "NOT_RUN" if result.get("stage") != "behavior-" + suite or result.get("diagnostic", {}).get("phase") in ("fixture", "prepare_context", "assertions") else "FAIL",
            "materialization_assertions": "PASS" if result.get("materialization_assertions") is True else "NOT_RUN",
            "injection": "PASS" if suite in FAULT_SUITES and result.get("injection_observed") is True else "NOT_RUN",
            "stage": "complete_owned_cleanup_confirmed" if accepted else result.get("stage"),
            "diagnostic": result.get("diagnostic"), "failure_type": result.get("error_type"), "stages": stages,
            "cleanup_verified": cleanup_ok(result), "cleanup": result.get("cleanup"), "cleanup_failure_type": result.get("cleanup_error_type"), "candidate": result.get("candidate")}

def fault_probes_allowed(happy):
    # A replay defect remains FAIL, but does not hide independent rollback probes
    # after real materialization + deferred guards and verified owned cleanup.
    return happy.get("status") == "PASS" or (
        happy.get("materialization_assertions") == "PASS" and happy.get("cleanup_verified") is True
        and happy.get("diagnostic", {}).get("phase") == "happy_materialized")

def run_case(output, suite, frozen, compile_frozen, bundle, compile_module, infrastructure, variant, proposal, correction):
    class BehaviorRunner(infrastructure.Runner):
        def install(self, body, label, db=DATABASE, user="postgres"):
            require(db in ("postgres", DATABASE) and user in ("postgres", "supabase_admin"), "Non-fixture target")
            self.inspect_owned()
            self.result["stage"] = label
            self.save()
            self.counter += 1
            prefix = self.output / "logs" / f"{self.counter:03d}-{label}"
            prefix.with_suffix(".sql").write_bytes(body)
            args = ["docker", "exec", "-i", self.cid, "psql", "-X", "-w", "-qAt", "-h", "/tmp/crm/socket", "-p", "5432", "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"]
            try:
                response = subprocess.run(args, input=body, capture_output=True, env=self.env, timeout=180)
            except subprocess.TimeoutExpired as error:
                stdout, stderr = error.stdout or b"", error.stderr or b""
                prefix.with_suffix(".stdout").write_bytes(stdout)
                prefix.with_suffix(".stderr").write_bytes(stderr)
                self.result["diagnostic"] = diagnose(stdout, stderr, label, "timeout")
                raise RuntimeError("Synthetic SQL timeout at " + label) from None
            self.result["materialization_assertions"] = response.stdout.decode(errors="replace").splitlines().count("FINANCIAL_MATERIALIZATION_ASSERTIONS_COMPLETE_happy") == 1
            self.result["injection_observed"] = suite in FAULT_SUITES and response.stdout.decode(errors="replace").splitlines().count("FINANCIAL_INJECTION_OBSERVED_" + suite) == 1
            prefix.with_suffix(".stdout").write_bytes(response.stdout)
            prefix.with_suffix(".stderr").write_bytes(response.stderr)
            if response.returncode:
                self.result["diagnostic"] = diagnose(response.stdout, response.stderr, label, response.returncode)
                raise RuntimeError("Synthetic SQL failed at " + label)
            self.result["stages"].append({"stage": label, "status": "PASS", "stdin_sha256": sha(body)})
            self.save()
            return response.stdout.decode()
    output.mkdir()
    (output / "logs").mkdir()
    r = BehaviorRunner(output, uuid.uuid4().hex)
    r.result.update(stages=[], stage="preflight")
    successful = False
    try:
        r.start()
        r.install(("CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;"
                   "CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;"
                   "CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;"
                   "CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;"
                   "GRANT service_role TO postgres;CREATE DATABASE " + DATABASE + " OWNER postgres TEMPLATE template0;").encode(), "synthetic-infrastructure", db="postgres", user="supabase_admin")
        context = r.install(b"SELECT jsonb_build_object('user',current_user,'session',session_user,'version',current_setting('server_version_num'),'superuser',rolsuper,'bypassrls',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'inherit',rolinherit,'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER'),'listen',current_setting('listen_addresses'),'address',inet_server_addr()) FROM pg_roles WHERE rolname=current_user;", "candidate-context")
        candidate = json.loads(context)
        require(candidate == {"user": "postgres", "session": "postgres", "version": "170006", "superuser": False, "bypassrls": True, "createdb": False, "createrole": False, "inherit": False, "admin_member": False, "listen": "", "address": None}, "Candidate context differs")
        r.result["candidate"] = candidate
        bootstrap = r.install(compile_frozen["sql/bootstrap.sql"], "synthetic-auth-bootstrap")
        require(bootstrap.splitlines().count("FINANCIAL_COMPILE_BOOTSTRAP_EMPTY_AUTH_COMPLETE") == 1, "Bootstrap marker missing")
        r.install(bundle.catalog_sql, "canonical-catalog")
        r.install(bundle.validation_sql, "canonical-function-revalidation")
        for i, path in enumerate(compile_module.INSTALL_ORDER):
            r.install(variant if path == "upstream/flow/sql/02-manifest.sql" else compile_frozen[path], "installer-" + str(i + 1).zfill(2))
        verified = r.install(compile_module.expected_sql(bundle.manifest) + compile_frozen["sql/verify-install.sql"], "verify-install")
        require(verified.splitlines().count("FINANCIAL_COMPILE_INSTALL_VERIFIED") == 1, "Install marker missing")
        if proposal == "retry-corrected":
            correction_output = r.install(correction, "proposed-same-context-retry-correction")
            require(correction_output.splitlines().count("FINANCIAL_PROPOSED_RETRY_CORRECTION_VERIFIED") == 1, "Correction marker missing")
        r.install(b"GRANT USAGE ON SCHEMA demo_flow_writer TO service_role;GRANT EXECUTE ON FUNCTION demo_flow_writer.prepare_execute_checkpoint(uuid,bigint) TO service_role;", "synthetic-boundary-privileges")
        outcome = r.install(suite_sql(frozen, suite), "behavior-" + suite)
        for marker in ("FINANCIAL_ASSERTIONS_COMPLETE_", "FINANCIAL_ROLLBACK_COMPLETE_"):
            require(outcome.splitlines().count(marker + suite) == 1, "Suite marker missing or duplicate")
        r.result["suite_markers"] = True
        successful = True
    except Exception as error:
        r.result.update(error_type=type(error).__name__, status="failed")
    finally:
        try:
            r.cleanup()
        except Exception as error:
            r.result.update(cleanup_error_type=type(error).__name__, cleanup="failed_verification")
        finally:
            r.save()
    return case_summary(r.result, suite, successful, compile_module.EXPECTED_STAGES, proposal)

def run(output, selected, proposal="original"):
    require(os.environ.get("GITHUB_ACTIONS") == "true", "Actions-only behavior; no local SQL/Docker")
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    gate(event, os.environ, head)
    frozen, pins = verify_inputs()
    cm = module("financial_behavior_compile", COMPILE / "run_ci.py")
    compile_frozen = cm.verify_inputs()
    require(proposal in PROPOSALS, "Unknown proposal")
    correction, correction_evidence = correction_input(frozen, compile_frozen) if proposal == "retry-corrected" else (None, None)
    variant, variant_evidence = laboratory_manifest(compile_frozen["upstream/flow/sql/02-manifest.sql"])
    catalog = module("financial_behavior_catalog", COMPILE / "catalog.py")
    infrastructure = module("financial_behavior_golden", INFRA)
    baseline = subprocess.check_output(["git", "show", head + ":supabase/schema/baseline.sql"], cwd=ROOT)
    bundle = catalog.build_catalog(baseline)
    require(sha(bundle.catalog_sql) == pins["catalog_sha256"] and sha(bundle.validation_sql) == pins["validation_sha256"], "Exact compiled catalog differs")
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    public = output / "public"
    public.mkdir()
    if correction_evidence:
        (public / "proposed-retry-correction.json").write_text(json.dumps(correction_evidence, indent=2) + "\n")
    (public / "laboratory-manifest-variant.json").write_text(json.dumps(variant_evidence, indent=2) + "\n")
    (public / "catalog-manifest.json").write_text(json.dumps(bundle.manifest, indent=2) + "\n")
    (public / "dependency-report.json").write_text(json.dumps(bundle.report, indent=2) + "\n")
    summary = {"scope": "AUTHENTIC_ENGINE_EXPLICIT_LAB_MANIFEST_VARIANT_SYNTHETIC_FIXTURES_ASSERTIONS_THEN_ROLLBACK", "status": "FAIL", "workflow_commit": head,
               "proposal": proposal, "event_base": EVENT_BASE, "compile_commit": COMPILE_SHA, "catalog_sha256": pins["catalog_sha256"], "validation_sha256": pins["validation_sha256"],
               "complete": False, "canonical_closure_complete": False, "fixtures_complete": False,
               "real_identity": "NOT_RUN", "real_authentication": "NOT_RUN", "runtime_acl_rls": "NOT_RUN", "business_commit": "NOT_RUN",
               "operational_wire": "UNBOUND", "configuration": "EMPTY", "demo": "DISABLED", "live_database_actions": 0,
               "cases": [], "limits": ["Synthetic candidate BYPASSRLS and service_role membership are disposable fixtures; no real ACL certification",
               "Assertions then ROLLBACK do not certify business COMMIT, WAL durability, transport ACK, failover, or external identity"]}
    def save():
        (public / "result.json").write_text(json.dumps(summary, indent=2) + "\n")
    save()
    available = SUITES if proposal == "retry-corrected" else ("happy", *FAULT_SUITES)
    suites = available if selected == "all" else ("happy", selected) if selected != "happy" else ("happy",)
    for suite in suites:
        if summary["cases"] and not fault_probes_allowed(summary["cases"][0]):
            summary["cases"].append({"suite": suite, "status": "NOT_RUN", "reason": "materialization/deferred-guard prerequisite failed"})
        else:
            summary["cases"].append(run_case(output / suite, suite, frozen, compile_frozen, bundle, cm, infrastructure, variant, proposal, correction))
        save()
    summary["status"] = "PASS_SYNTHETIC_ROLLBACK_ONLY" if all(c["status"] == "PASS" for c in summary["cases"]) else "FAIL"
    summary["selected_suite"] = selected
    summary["replay"] = "FAIL" if summary["cases"][0].get("diagnostic", {}).get("phase") == "happy_materialized" else "PASS" if summary["cases"][0]["status"] == "PASS" else "NOT_RUN"
    save()
    print(json.dumps(summary))
    require(summary["status"] == "PASS_SYNTHETIC_ROLLBACK_ONLY", "Behavior or cleanup incomplete; inspect bounded evidence")
    return summary

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--suite", choices=(*SUITES, "all"), default="happy")
    parser.add_argument("--proposal", choices=PROPOSALS, default="original")
    args = parser.parse_args()
    def interrupted(number, frame):
        raise RuntimeError("Interrupted by signal " + str(number))
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    run(args.output, args.suite, args.proposal)

if __name__ == "__main__":
    main()
