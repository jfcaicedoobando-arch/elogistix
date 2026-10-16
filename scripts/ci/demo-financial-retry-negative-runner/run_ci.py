#!/usr/bin/env python3
"""Actions-only adapter for the immutable independent PR357 negative cases."""
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
BEHAVIOR = ROOT / "scripts/ci/demo-financial-behavior-recovery"
REVIEW = ROOT / "scripts/ci/demo-financial-retry-negative-review"
AUTHOR = "a7aff9ff8f92852687c56d3bc05d41150b44b2ae"
REVIEW_COMMIT = "fd3a2fcb940dc122fda7be242afda05a053dd61d"
SUPPLEMENT_COMMIT = "7d38dc8ad3959b853d7fe60a556f671c60a5b244"
SUPPLEMENT_CASE_IDS = ("foreign_bound_concept_id", "foreign_bound_payment_id", "tenant_authority_reassignment")
SEQUENCE_CONTROL_ID = "sequence_nontransactional_control"
DATABASE = "demo_financial_compile_recovery_lab"
CASE_IDS = ("foreign_bound_invoice_id", "authority_scheduler_disabled", "authority_transport_disabled", "tenant_organization_inactive", "manifest_scheduler_hash_drift", "expiry_run_shortened", "guarded_tenant_run_rebinding", "mutable_supplier_origin_drift", "materialized_invoice_folio_drift")

def require(value, message):
    if not value: raise RuntimeError(message)

def sha(body): return hashlib.sha256(body).hexdigest()

def file_bytes(path):
    body = path.read_bytes()
    return body.replace(b"\r\n", b"\n") if os.name == "nt" else body

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result

def inventory(base, rows):
    result = {}
    for row in rows:
        require(set(row) == {"path", "bytes", "sha256"}, "Malformed pin")
        rel = row["path"]
        require(isinstance(rel, str) and rel and "\\" not in rel and ":" not in rel and not PurePosixPath(rel).is_absolute()
                and all(p not in ("", ".", "..") for p in rel.split("/")) and rel not in result, "Unsafe pin")
        path = base / rel
        require(path.is_file() and base in path.resolve().parents and not any(p.is_symlink() for p in (path, *path.parents) if base in p.parents), "Missing or symlink input")
        body = file_bytes(path)
        require(type(row["bytes"]) is int and len(body) == row["bytes"] and sha(body) == row["sha256"], "Hash drift: " + rel)
        result[rel] = body
    require(result, "Empty pins")
    return result

def verify_inputs():
    frozen = inventory(HERE, json.loads((HERE / "inputs.json").read_text()))
    actual = {p.relative_to(HERE).as_posix() for p in HERE.rglob("*") if p.is_file()}
    require(actual == set(frozen) | {"inputs.json"}, "Incomplete adapter inventory")
    require(not any(p.is_symlink() for p in HERE.rglob("*")), "Symlink member")
    pins = json.loads(frozen["source-pins.json"])
    require(pins["author_fix_head"] == AUTHOR and pins["review_commit"] == REVIEW_COMMIT
            and pins["integration_commit"] == "bd07f5488babb770d226f91f05abfcb1a2cb68d8", "Provenance differs")
    require(pins["supplement_commit"] == SUPPLEMENT_COMMIT and pins["supplement_integration_commit"] == "02a4ed7846b82738b1f23840567f4193860ad9ed", "Supplement provenance differs")
    external = inventory(ROOT, pins["files"])
    require(len(external) == 50, "Exact50 independent/fix sources required")
    for directory in (BEHAVIOR, REVIEW):
        actual = {p.relative_to(ROOT).as_posix() for p in directory.rglob("*") if p.is_file()}
        expected = {p for p in external if p.startswith(directory.relative_to(ROOT).as_posix() + "/")}
        require(actual == expected, "External package inventory differs")
    return frozen, pins

def cleanup_ok(result):
    return result.get("cleanup") == "confirmed_stopped_and_removed" and all(result.get(k) is True for k in ("shutdown_confirmed", "pg_status_3_and_no_pid", "owned_psql_clients_closed"))

def accept_case(result, native, expected_stages):
    stages = result.get("stages", [])
    return (native.get("status") == "ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP" and cleanup_ok(result)
            and [r.get("stage") for r in stages] == expected_stages and all(r.get("status") == "PASS" for r in stages)
            and result.get("install_verified") is True)

def run_case(output, case, review, bm, cm, infrastructure, bundle, compile_frozen, behavior_frozen, variant, correction):
    case_id = case["id"]
    class ReviewRunner(infrastructure.Runner):
        def install(self, body, label, db=DATABASE, user="postgres", required=True):
            require(db in ("postgres", DATABASE) and user in ("postgres", "supabase_admin"), "Nonfixture target")
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
                self.result["diagnostic"] = bm.diagnose(stdout, stderr, label, "timeout")
                raise RuntimeError("Owned SQL timeout") from None
            prefix.with_suffix(".stdout").write_bytes(response.stdout)
            prefix.with_suffix(".stderr").write_bytes(response.stderr)
            self.result["stages"].append({"stage": label, "status": "PASS" if response.returncode == 0 else "FAIL", "stdin_sha256": sha(body)})
            if response.returncode:
                self.result["diagnostic"] = bm.diagnose(response.stdout, response.stderr, label, response.returncode)
                markers = re.findall(r"^RETRY_(?:NEGATIVE|SUPPLEMENT)_[A-Z_]+_" + re.escape(case_id) + r"$", response.stdout.decode(errors="replace"), re.M)
                self.result["diagnostic"]["last_review_marker"] = markers[-1] if markers else None
            self.save()
            if required: require(response.returncode == 0, "Owned SQL failed at " + label)
            return response
    output.mkdir()
    (output / "logs").mkdir()
    r = ReviewRunner(output, uuid.uuid4().hex)
    r.result.update(stages=[], stage="preflight")
    native = {"status": "NOT_RUN", "markers": []}
    try:
        r.start()
        r.install(("CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;"
                   "CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;"
                   "CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;"
                   "CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;"
                   "GRANT service_role TO postgres;CREATE DATABASE " + DATABASE + " OWNER postgres TEMPLATE template0;").encode(), "synthetic-infrastructure", db="postgres", user="supabase_admin")
        response = r.install(b"SELECT jsonb_build_object('user',current_user,'session',session_user,'version',current_setting('server_version_num'),'superuser',rolsuper,'bypassrls',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'inherit',rolinherit,'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER'),'listen',current_setting('listen_addresses'),'address',inet_server_addr()) FROM pg_roles WHERE rolname=current_user;", "candidate-context")
        candidate = json.loads(response.stdout)
        require(candidate == {"user":"postgres","session":"postgres","version":"170006","superuser":False,"bypassrls":True,"createdb":False,"createrole":False,"inherit":False,"admin_member":False,"listen":"","address":None}, "Candidate differs")
        r.result["candidate"] = candidate
        response = r.install(compile_frozen["sql/bootstrap.sql"], "synthetic-auth-bootstrap")
        require(response.stdout.decode().splitlines().count("FINANCIAL_COMPILE_BOOTSTRAP_EMPTY_AUTH_COMPLETE") == 1, "Bootstrap marker")
        r.install(bundle.catalog_sql, "canonical-catalog")
        r.install(bundle.validation_sql, "canonical-function-revalidation")
        for i, path in enumerate(cm.INSTALL_ORDER):
            r.install(variant if path == "upstream/flow/sql/02-manifest.sql" else compile_frozen[path], "installer-" + str(i+1).zfill(2))
        response = r.install(cm.expected_sql(bundle.manifest) + compile_frozen["sql/verify-install.sql"], "verify-install")
        require(response.stdout.decode().splitlines().count("FINANCIAL_COMPILE_INSTALL_VERIFIED") == 1, "Install marker")
        r.result["install_verified"] = True
        response = r.install(correction, "proposed-same-context-retry-correction")
        require(response.stdout.decode().splitlines().count("FINANCIAL_PROPOSED_RETRY_CORRECTION_VERIFIED") == 1, "Correction marker")
        r.install(b"GRANT USAGE ON SCHEMA demo_flow_writer TO service_role;GRANT EXECUTE ON FUNCTION demo_flow_writer.prepare_execute_checkpoint(uuid,bigint) TO service_role;", "synthetic-boundary-privileges")
        sources = {name: behavior_frozen["sql/" + name] for name in (review.BASE.CONTRACT if hasattr(review,"BASE") else review.CONTRACT)["external_sources"]}
        body = review.sequence_control_sql(sources, author_fix_head=AUTHOR) if case_id == SEQUENCE_CONTROL_ID else review.suite_sql(case_id, sources, author_fix_head=AUTHOR)
        response = r.install(body, "review-native-" + case_id, required=False)
        response_fields = dict(stdout=response.stdout.decode(errors="replace"), stderr=response.stderr.decode(errors="replace"), returncode=response.returncode)
        native = review.inspect_sequence_control(**response_fields) if case_id == SEQUENCE_CONTROL_ID else review.inspect_result(case_id, **response_fields)
    except Exception as error:
        r.result.update(error_type=type(error).__name__)
    finally:
        try: r.cleanup()
        except Exception as error: r.result.update(cleanup="failed_verification", cleanup_error_type=type(error).__name__)
        finally: r.save()
    expected = [*cm.EXPECTED_STAGES, "proposed-same-context-retry-correction", "synthetic-boundary-privileges", "review-native-" + case_id]
    accepted = accept_case(r.result, native, expected)
    return {"case_id":case_id,"status":"PASS" if accepted else "FAIL", "phase":case["phase"],"rejection_stage":case.get("rejection_stage","rpc"),
            "kind":"sequence_calibration" if case_id == SEQUENCE_CONTROL_ID else "negative_denial", "expected_sqlstate":case.get("expected_sqlstate"),"expected_message":case.get("expected_message"),
            "positive_retry":"PASS" if accepted and case["phase"]=="materialized" else "NOT_RUN", "native_evidence":native,
            "diagnostic":r.result.get("diagnostic"),"failure_type":r.result.get("error_type"),"cleanup":r.result.get("cleanup"),"cleanup_verified":cleanup_ok(r.result),
            "cleanup_failure_type":r.result.get("cleanup_error_type"),"stages":r.result["stages"],"candidate":r.result.get("candidate")}

def run(output, group="original"):
    require(os.environ.get("GITHUB_ACTIONS")=="true", "Actions only; local SQL/Docker forbidden")
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    head = subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    frozen,pins = verify_inputs()
    bm = module("review_negative_author", BEHAVIOR / "run_ci.py")
    bm.gate(event,os.environ,head)
    behavior_frozen,behavior_pins = bm.verify_inputs()
    cm = module("review_negative_compile", bm.COMPILE / "run_ci.py")
    compile_frozen = cm.verify_inputs()
    require(sha(file_bytes(bm.INFRA))==bm.INFRA_SHA,"Golden infrastructure changed")
    infrastructure = module("review_negative_golden", bm.INFRA)
    require(group in ("original","supplement"),"Unknown independent group")
    review = module("review_negative_provider", REVIEW / ("suite.py" if group == "original" else "supplemental_suite.py"))
    require(tuple(c["id"] for c in review.CASES)==(CASE_IDS if group == "original" else SUPPLEMENT_CASE_IDS),"Exact independent cases required")
    cases = list(review.CASES)
    if group == "supplement":
        cases.append({"id":SEQUENCE_CONTROL_ID,"phase":"materialized","rejection_stage":"calibration"})
    catalog = module("review_negative_catalog",bm.COMPILE / "catalog.py")
    baseline = subprocess.check_output(["git","show",head+":supabase/schema/baseline.sql"],cwd=ROOT)
    bundle = catalog.build_catalog(baseline)
    require(sha(bundle.catalog_sql)==behavior_pins["catalog_sha256"] and sha(bundle.validation_sql)==behavior_pins["validation_sha256"],"Exact compiled catalog differs")
    variant,variant_evidence = bm.laboratory_manifest(compile_frozen["upstream/flow/sql/02-manifest.sql"])
    correction,correction_evidence = bm.correction_input(behavior_frozen,compile_frozen)
    output = Path(output);output.mkdir(parents=True,exist_ok=False)
    public = output / "public";public.mkdir()
    for name,data in (("catalog-manifest",bundle.manifest),("dependency-report",bundle.report),("laboratory-manifest-variant",variant_evidence),("proposed-retry-correction",correction_evidence)):
        (public/(name+".json")).write_text(json.dumps(data,indent=2)+"\n")
    summary = {"scope":"INDEPENDENT_RETRY_NEGATIVES_SYNTHETIC_ROW_ROLLBACK_ONLY" if group=="original" else "INDEPENDENT_SUPPLEMENT_ROWS_AND_SEQUENCE_OBSERVATIONS_ONLY","status":"FAIL","workflow_commit":head,"author_fix_head":AUTHOR,
               "group":group,"review_commit":REVIEW_COMMIT,"supplement_commit":SUPPLEMENT_COMMIT,"supplement_integration_commit":pins["supplement_integration_commit"],"integration_commit":pins["integration_commit"],"event_base":bm.EVENT_BASE,
               "catalog_sha256":sha(bundle.catalog_sql),"validation_sha256":sha(bundle.validation_sql),"cases":[],"blocked_cases":review.BLOCKED_CASES,
               "complete":False,"canonical_closure_complete":False,"fixtures_complete":False,"business_commit":"NOT_RUN","sequence_rollback":"NOT_ESTABLISHED",
               "real_identity":"NOT_RUN","runtime_acl_rls":"NOT_RUN","operational_wire":"UNBOUND","configuration":"EMPTY","demo":"DISABLED","live_database_actions":0,
               "limits":["Rows and separate sequence observations only; no sequence rollback, catalog, crash, durability or real transport acceptance","Attested cross-tenant identity retry remains NOT_RUN; reassigned membership is only current tenant authority"]}
    def save(): (public/"result.json").write_text(json.dumps(summary,indent=2)+"\n")
    save()
    for case in cases:
        summary["cases"].append(run_case(output/case["id"],case,review,bm,cm,infrastructure,bundle,compile_frozen,behavior_frozen,variant,correction));save()
    summary["status"]=("PASS_SYNTHETIC_REVIEW_NEGATIVES_ROLLBACK_ONLY" if group == "original" else "PASS_SYNTHETIC_REVIEW_SUPPLEMENT_ONLY") if all(c["status"]=="PASS" for c in summary["cases"]) else "FAIL"
    save();print(json.dumps(summary))
    require(summary["status"] in ("PASS_SYNTHETIC_REVIEW_NEGATIVES_ROLLBACK_ONLY","PASS_SYNTHETIC_REVIEW_SUPPLEMENT_ONLY"),"Independent native assertions or cleanup incomplete")
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--output",type=Path,required=True);parser.add_argument("--group",choices=("original","supplement"),default="original");args=parser.parse_args()
    def interrupted(number,frame): raise RuntimeError("Interrupted by signal "+str(number))
    for sig in (signal.SIGINT,signal.SIGTERM): signal.signal(sig,interrupted)
    run(args.output,args.group)

if __name__=="__main__":main()
