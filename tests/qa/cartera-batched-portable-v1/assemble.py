#!/usr/bin/env python3
"""Assemble an isolated source-exact harness from reviewed text and pinned Git reads.

This helper is new transfer tooling, not a file in the original portable ZIP.
It performs no network access, Git writes, dependency install, build, or execution.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--validate-inputs-only", action="store_true")
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    selected = json.loads((source / "selected-original-files.json").read_text())
    manifest = json.loads((source / "TRANSFER-MANIFEST.json").read_text())
    staged = []
    for item in selected:
        relative = Path(item["path"])
        assert not relative.is_absolute() and ".." not in relative.parts
        data = (source / relative).read_bytes()
        assert len(data) == item["bytes"], relative
        assert digest(data) == item["sha256"], relative
        assert git_blob(data) == item["git_blob"], relative
        data.decode("utf-8")
        staged.append((relative, data))
    if args.validate_inputs_only:
        print(json.dumps({"selected_original_text_files": len(staged), "all_hashes_match": True}))
        return
    parser.error("--repo and --output are required") if args.repo is None or args.output is None else None
    repo = args.repo.resolve()
    output = args.output.resolve()
    if output.exists():
        parser.error("--output must not exist; this helper never overwrites a previous run")
    for item in manifest["reused_repository_files"]:
        data = subprocess.run(
            ["git", "-C", str(repo), "show", f"{manifest['base_commit']}:{item['path']}"],
            check=True, capture_output=True,
        ).stdout
        assert len(data) == item["bytes"], item["path"]
        assert digest(data) == item["sha256"], item["path"]
        assert git_blob(data) == item["git_blob"], item["path"]
        staged.append((Path(item["destination"]), data))
    assert len({str(relative) for relative, _ in staged}) == len(staged)
    output.mkdir(parents=True, exist_ok=False)
    for relative, data in staged:
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    (output / "assembly-provenance.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"output": str(output), "files": len(staged), "base_commit": manifest["base_commit"], "all_hashes_match": True}))


if __name__ == "__main__":
    main()
