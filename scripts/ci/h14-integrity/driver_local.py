#!/usr/bin/env python3
"""Invoke shared H14 races only through the reviewed, owned local lab contract."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys


def require(condition, message):
    if condition is not True:
        raise RuntimeError(message)


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("contract", "helper", "slot", "output"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    require(args.slot == "races", "Only the owned races slot is accepted")
    contract_path = Path(args.contract).resolve(strict=True)
    c = json.loads(contract_path.read_text())
    helper_path = Path(args.helper).resolve(strict=True)
    require(helper_path == Path(c["exec_helper"]), "Reviewed helper required")
    require(hashlib.sha256(helper_path.read_bytes()).hexdigest() == c["infra_files"]["exec_helper.py"]["sha256"], "Helper hash changed")
    helper = load_module(helper_path, "h14_correction_transport")
    c = helper.load_contract(contract_path)
    helper.verify_owned(c)
    output = Path(args.output).resolve()
    require(output.is_relative_to(Path(c["run_dir"])) and output != Path(c["run_dir"]), "Private run output required")

    def reviewed(relative):
        return helper.reviewed_path(c, Path(c["suite_roots"]["races"]) / relative)

    module = load_module(reviewed("concurrency.py"), "h14_correction_races")
    fixtures = helper.reviewed_path(c, Path(c["suite_roots"]["finance"]) / "fixture_helpers.sql")
    capture = reviewed("capture.sql")
    context = module.Context(
        session_argv=[c["python_binary"], "-I", str(helper_path), "--contract", str(contract_path), "--slot", "races", "--session"],
        env=helper.clean_env(c), output=output, database=c["databases"]["races"], run_id=c["run_id"],
        source_commit=c["source_commit"], rpc_md5=c["candidate_rpc_md5"],
        fixture_helpers=fixtures.read_text(), capture_helpers=capture.read_text(),
    )
    result = module.run_concurrency(context)
    print(json.dumps(result), flush=True)
    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
