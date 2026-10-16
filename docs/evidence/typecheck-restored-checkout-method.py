#!/usr/bin/env python3
"""Compare useful restored TS state after a checkout with new mtimes.

Run only after both source benchmark series have completed. Each variant gets
its own archived checkout and frozen installation. Three A/B pairs restore the
same clean state before every run, retime included tracked inputs without
changing their bytes, and invoke the published command. Environment files are
excluded by path before extraction or content hashing; example files remain.
This excludes cache transfer costs and does not restore the old node_modules
archive or flush OS caches.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time


VARIANTS = (
    {
        "name": "baseline-86020",
        "ref": "86020fb322bb56c44e4a644c14e0798d480b62ce",
        "series": "/tmp/elogistix-tscache-baseline-86020",
        "cacheDir": "node_modules/.cache/tsc",
        "command": ["bun", "run", "typecheck"],
    },
    {
        "name": "candidate-caf5dcbc",
        "ref": "caf5dcbc493915e421d6d2b6792e6a92f5384834",
        "series": "/tmp/elogistix-tscache-combined-caf5dcbc",
        "cacheDir": ".cache/tsc",
        "command": ["bun", "run", "typecheck:ci"],
    },
)
CACHE_NAMES = ("tsconfig.app.tsbuildinfo", "tsconfig.node.tsbuildinfo")
SOURCE = "src/lib/financial/tcValido.ts"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    temporary = path.with_suffix(path.suffix + ".writing")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def capture(command, cwd, env):
    return subprocess.check_output(
        command, cwd=cwd, env=env, stderr=subprocess.STDOUT, text=True,
        shell=False, timeout=60,
    ).strip()


def logged(command, cwd, env, path):
    started = time.perf_counter()
    with path.open("w") as log:
        process = subprocess.Popen(
            command, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
            stdout=log, stderr=subprocess.STDOUT, shell=False,
            start_new_session=True,
        )
        timed_out = False
        try:
            status = process.wait(timeout=1200)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            log.write("\nBenchmark process group exceeded 1200 seconds.\n")
            status = 124
    return {
        "seconds": round(time.perf_counter() - started, 4),
        "exitCode": status, "timedOut": timed_out,
        "log": path.name, "logSHA256": digest(path.read_bytes()),
    }


def excluded_environment_path(path):
    return any(
        (part == ".env" or part.startswith(".env.")) and not part.endswith(".example")
        for part in Path(path).parts
    )


def require_no_autoload_env(root):
    if any(excluded_environment_path(path.name) for path in root.glob(".env*")):
        raise ValueError("Checkout contains an environment autoload path; refusing to run Bun")


def tracked_paths(repo, ref, env):
    raw = subprocess.check_output(
        ["git", "ls-tree", "-r", "-z", "--name-only", ref],
        cwd=repo, env=env, shell=False,
    )
    entries = [Path(name.decode()) for name in raw.split(b"\0") if name]
    if not entries:
        raise ValueError("The tracked input manifest is empty")
    for path in entries:
        if path.is_absolute() or ".." in path.parts:
            raise ValueError(f"Unsafe tracked path: {path}")
    excluded = [path.as_posix() for path in entries if excluded_environment_path(path)]
    paths = [path for path in entries if not excluded_environment_path(path)]
    if not paths:
        raise ValueError("The included tracked input manifest is empty")
    return paths, excluded


def inventory(root, paths):
    entries = []
    for relative in paths:
        path = root / relative
        mode = path.lstat().st_mode
        if stat.S_ISLNK(mode):
            kind, contents = "symlink", os.fsencode(os.readlink(path))
        elif stat.S_ISREG(mode):
            kind, contents = "file", path.read_bytes()
        else:
            raise ValueError(f"Unsupported tracked entry: {relative}")
        entries.append({"path": relative.as_posix(), "kind": kind, "sha256": digest(contents)})
    return entries


def inventory_digest(entries):
    return digest(json.dumps(entries, sort_keys=True, separators=(",", ":")).encode())


def cache_snapshot(root, cache_dir):
    answer = {}
    for name in CACHE_NAMES:
        relative = Path(cache_dir) / name
        path = root / relative
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"Missing or unsafe cache file: {relative}")
        contents = path.read_bytes()
        if json.loads(contents).get("version") != "6.0.3":
            raise ValueError(f"Unexpected compiler version in {relative}")
        answer[relative.as_posix()] = {
            "bytes": len(contents), "sha256": digest(contents),
            "mtimeNs": path.stat().st_mtime_ns,
        }
    return answer


def prepare_evidence(variant):
    directory = Path(variant["series"])
    metadata = json.loads((directory / "metadata.json").read_text())
    if metadata.get("completed") is not True or metadata.get("sourceSHA") != variant["ref"]:
        raise ValueError(f"Source series is incomplete or has a different SHA: {directory}")
    for field, expected in [("node", "v24.22.0"), ("bun", "1.4.0"), ("typescript", "6.0.3")]:
        if metadata.get(field) != expected:
            raise ValueError(f"Unexpected {field} in {directory}")
    if metadata.get("command") != variant["command"] or metadata.get("cacheDir") != variant["cacheDir"]:
        raise ValueError(f"Command/cache provenance does not match {directory}")
    records = json.loads((directory / "results.json").read_text())
    warm = [record for record in records if record["replica"] == 1 and record["phase"] == "warm"]
    phases = {(record["replica"], record["phase"]) for record in records}
    wanted = {(replica, phase) for replica in range(1, 4) for phase in ("cold", "warm", "incremental")}
    if len(records) != 9 or phases != wanted or any(record["exitCode"] != 0 for record in records) or len(warm) != 1:
        raise ValueError(f"Source series must contain all nine successful checks: {directory}")
    expected = warm[0]["cacheAfter"]
    archive = directory / "1-clean-cache.tar"
    expected_paths = {str(Path(variant["cacheDir"]) / name) for name in CACHE_NAMES}
    if set(expected) != expected_paths:
        raise ValueError(f"Unexpected recorded cache paths: {directory}")
    payloads = {}
    with tarfile.open(archive) as caches:
        members = caches.getmembers()
        if len(members) != 2 or {member.name for member in members} != expected_paths:
            raise ValueError(f"Unexpected cache archive members: {archive}")
        for member in members:
            if not member.isfile() or member.issym() or member.islnk():
                raise ValueError(f"Cache archive contains a non-regular entry: {member.name}")
            with caches.extractfile(member) as handle:
                contents = handle.read()
            if digest(contents) != expected[member.name]["sha256"]:
                raise ValueError(f"Cache archive differs from recorded clean state: {member.name}")
            if json.loads(contents).get("version") != "6.0.3":
                raise ValueError(f"Unexpected TypeScript cache version: {member.name}")
            payloads[member.name] = contents
    return metadata, expected, payloads, digest(archive.read_bytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default="/workspace/elogistix")
    parser.add_argument("--output", default="/tmp/elogistix-tscache-restored-checkout")
    args = parser.parse_args()
    repo, output = Path(args.repo).resolve(), Path(args.output).resolve()
    if output.exists() or output.is_relative_to(repo):
        raise ValueError("Output must be a new directory outside the repository")
    env = os.environ.copy()
    env.update(CI="true", SENTRY_AUTH_TOKEN="", BUN_INSTALL_CACHE_DIR="/tmp/elogistix-bun-cache")
    node, bun = capture(["node", "--version"], repo, env), capture(["bun", "--version"], repo, env)
    if (node, bun) != ("v24.22.0", "1.4.0"):
        raise ValueError(f"Expected Node v24.22.0 / Bun 1.4.0; got {node} / {bun}")
    prepared = []
    for variant in VARIANTS:
        resolved = capture(["git", "rev-parse", "--verify", "--end-of-options", variant["ref"] + "^{commit}"], repo, env)
        if resolved != variant["ref"]:
            raise ValueError(f"Unexpected Git ref: {variant['name']}")
        evidence, caches, payloads, archive_hash = prepare_evidence(variant)
        paths, excluded_paths = tracked_paths(repo, resolved, env)
        prepared.append({**variant, "evidence": evidence, "cleanCaches": caches,
                         "payloads": payloads, "archiveSHA256": archive_hash,
                         "paths": paths, "excludedTrackedPaths": excluded_paths})
    output.mkdir(parents=True)
    metadata = {
        "node": node, "bun": bun, "typescript": "6.0.3", "replicas": 3,
        "order": [variant["name"] for _ in range(3) for variant in VARIANTS],
        "platform": platform.platform(), "helperSHA256": digest(Path(__file__).read_bytes()),
        "scenario": "Same included tracked bytes, clean TS state restored before every check, all included tracked mtimes newer than both cache files",
        "environmentExclusion": "Exclude .env and .env.* path components except names ending .example; inspect names/headers only, never excluded file content; retain only excluded path names in evidence",
        "limits": ["Fresh frozen dependency installs; not a restored node_modules archive",
                   "No cache network transfer timing or OS cache flush",
                   "Tracked files are hashed before timing, warming OS page cache",
                   "Three alternating A/B pairs, no randomization, no peak RSS measurement"],
        "variants": [], "completed": False,
    }
    results = []
    write_json(output / "metadata.json", metadata)
    with tempfile.TemporaryDirectory(prefix="elogistix-restored-checkout-", dir="/tmp") as temporary:
        for variant in prepared:
            root = Path(temporary) / variant["name"] / "checkout"
            root.mkdir(parents=True)
            archive = root.parent / "source.tar"
            subprocess.run(["git", "archive", "--format=tar", f"--output={archive}", variant["ref"]], cwd=repo, env=env, check=True, shell=False)
            with tarfile.open(archive) as sources:
                members = sources.getmembers()
                variant["excludedArchivePaths"] = [
                    member.name for member in members if excluded_environment_path(member.name)
                ]
                included_members = [
                    member for member in members if not excluded_environment_path(member.name)
                ]
                sources.extractall(root, members=included_members, filter="data")
            require_no_autoload_env(root)
            inputs = inventory(root, variant["paths"])
            install = logged(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], root, env, output / f"{variant['name']}-install.log")
            if install["exitCode"] != 0:
                write_json(output / f"{variant['name']}-install-result.json", install)
                raise RuntimeError(f"Frozen install failed: {variant['name']}")
            if inventory(root, variant["paths"]) != inputs:
                raise ValueError("Frozen installation changed tracked inputs")
            require_no_autoload_env(root)
            version = json.loads((root / "node_modules/typescript/package.json").read_text())["version"]
            if version != "6.0.3":
                raise ValueError(f"Unexpected installed TypeScript: {version}")
            if digest((root / SOURCE).read_bytes()) != variant["evidence"]["incrementalChange"]["originalSHA256"]:
                raise ValueError("Cache provenance does not match the original tracked source")
            variant.update(root=root, inputs=inputs)
            write_json(output / f"{variant['name']}-tracked-inputs.json", inputs)
            metadata["variants"].append({
                "name": variant["name"], "sourceSHA": variant["ref"], "command": variant["command"],
                "cacheDir": variant["cacheDir"], "sourceSeries": variant["series"],
                "cacheArchiveSHA256": variant["archiveSHA256"], "install": install,
                "excludedTrackedPaths": variant["excludedTrackedPaths"],
                "excludedArchivePaths": variant["excludedArchivePaths"],
                "trackedInputCount": len(inputs), "trackedInputSHA256": inventory_digest(inputs),
                "sourceInputSHA256": variant["evidence"]["inputSHA256"],
            })
            write_json(output / "metadata.json", metadata)
        for replica in range(1, 4):
            for variant in prepared:
                root = variant["root"]
                require_no_autoload_env(root)
                if inventory(root, variant["paths"]) != variant["inputs"]:
                    raise ValueError("Tracked inputs changed between replicas")
                for relative, contents in variant["payloads"].items():
                    cache = root / relative
                    cache.parent.mkdir(parents=True, exist_ok=True)
                    if cache.is_symlink() or not cache.parent.resolve().is_relative_to(root):
                        raise ValueError("Cache restoration would follow an unsafe path")
                    cache.write_bytes(contents)
                    original_time = variant["cleanCaches"][relative]["mtimeNs"]
                    os.utime(cache, ns=(original_time, original_time))
                before = cache_snapshot(root, variant["cacheDir"])
                latest = max(row["mtimeNs"] for row in before.values())
                now = time.time_ns()
                if latest > now + 1_000_000_000:
                    raise ValueError("Restored cache timestamp is unexpectedly in the future")
                timestamp = max(now, (latest // 1_000_000 + 2) * 1_000_000)
                for relative in variant["paths"]:
                    os.utime(root / relative, ns=(timestamp, timestamp), follow_symlinks=False)
                actual_times = [(root / path).lstat().st_mtime_ns for path in variant["paths"]]
                if min(actual_times) // 1_000_000 <= latest // 1_000_000:
                    raise ValueError("Tracked mtimes must be newer than both restored caches at millisecond precision")
                if inventory(root, variant["paths"]) != variant["inputs"]:
                    raise ValueError("Retiming changed tracked input bytes")
                record = logged(variant["command"], root, env, output / f"{replica}-{variant['name']}.log")
                cache_error = None
                try:
                    after = cache_snapshot(root, variant["cacheDir"])
                except (OSError, ValueError) as error:
                    after, cache_error = {}, str(error)
                record.update({
                    "replica": replica, "variant": variant["name"], "sourceSHA": variant["ref"],
                    "command": variant["command"], "cacheBefore": before, "cacheAfter": after,
                    "trackedInputSHA256": inventory_digest(variant["inputs"]),
                    "trackedMtimeMinNs": min(actual_times), "trackedMtimeMaxNs": max(actual_times),
                    "cacheContentChanged": {path: before[path]["sha256"] != after.get(path, {}).get("sha256") for path in before},
                    "cacheMtimeChanged": {path: before[path]["mtimeNs"] != after.get(path, {}).get("mtimeNs") for path in before},
                    "cacheValidationError": cache_error,
                    "trackedBytesPreserved": inventory(root, variant["paths"]) == variant["inputs"],
                })
                results.append(record)
                write_json(output / "results.json", results)
                print(json.dumps({key: record[key] for key in ["replica", "variant", "seconds", "exitCode", "trackedBytesPreserved"]}), flush=True)
                if record["exitCode"] != 0 or cache_error or not record["trackedBytesPreserved"]:
                    raise RuntimeError("A measured command failed, invalidated cache state, or changed tracked input bytes")
    metadata["completed"] = True
    write_json(output / "metadata.json", metadata)
    print(f"Evidence: {output}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError, tarfile.TarError) as error:
        print(f"Restored-checkout benchmark stopped: {error}", file=sys.stderr)
        raise SystemExit(1) from error
