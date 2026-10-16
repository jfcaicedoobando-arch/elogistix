#!/usr/bin/env python3
"""Measure three isolated cold/warm/incremental TypeScript cycles.

Requires Node 24.22.0, Bun 1.4.0, and Python with tarfile's data filter.
Only the temporary archive checkout is installed or edited. Commands use
argument lists with shell=False; no OS caches are flushed.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tarfile
import tempfile
import time


SOURCE = Path("src/lib/financial/tcValido.ts")
CACHE_NAMES = ("tsconfig.app.tsbuildinfo", "tsconfig.node.tsbuildinfo")
BEFORE = b"return Number.isFinite(n) && n > 0 ? n : null;"
AFTER = b"return !Number.isFinite(n) || n <= 0 ? null : n;"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def capture(argv, cwd, env):
    return subprocess.check_output(
        argv, cwd=cwd, env=env, text=True, stderr=subprocess.STDOUT, shell=False
    ).strip()


def optional_text(path):
    return path.read_text().strip() if path.is_file() else None


def snapshot(paths, root):
    return {
        str(path.relative_to(root)): {
            "exists": path.is_file(),
            "bytes": path.stat().st_size if path.is_file() else None,
            "mtimeNs": path.stat().st_mtime_ns if path.is_file() else None,
            "sha256": sha256(path.read_bytes()) if path.is_file() else None,
        }
        for path in paths
    }


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ref", required=True, help="Committed Git ref to archive")
    parser.add_argument(
        "--command", required=True,
        help='JSON argument list, for example ["bun", "run", "typecheck:ci"]',
    )
    parser.add_argument(
        "--cache-dir", required=True,
        help="Relative directory containing both project .tsbuildinfo files",
    )
    parser.add_argument("--output", required=True, help="New evidence directory outside the repo")
    args = parser.parse_args()
    try:
        command = json.loads(args.command)
    except json.JSONDecodeError as error:
        parser.error(f"--command must be a JSON argument list: {error}")
    if not isinstance(command, list) or not command or any(
        not isinstance(part, str) or not part or "\0" in part for part in command
    ):
        parser.error("--command must be a nonempty list of nonempty strings")
    cache_dir = Path(args.cache_dir)
    if cache_dir.is_absolute() or ".." in cache_dir.parts or cache_dir == Path("."):
        parser.error("--cache-dir must be a relative directory without '..'")
    return args, command, cache_dir


def main():
    args, command, cache_dir = arguments()
    repo = Path(__file__).resolve().parents[1]
    output = Path(args.output).resolve()
    if output.is_relative_to(repo):
        raise ValueError("--output must be outside the repository")
    if output.exists():
        raise ValueError("--output must be a new directory to preserve previous evidence")
    env = os.environ.copy()
    env.update(CI="true", SENTRY_AUTH_TOKEN="")
    node = capture(["node", "--version"], repo, env)
    bun = capture(["bun", "--version"], repo, env)
    if node != "v24.22.0" or bun != "1.4.0":
        raise ValueError(f"Expected Node v24.22.0 / Bun 1.4.0; got {node} / {bun}")
    ref = capture(
        ["git", "rev-parse", "--verify", "--end-of-options", f"{args.ref}^{{commit}}"],
        repo, env,
    )
    output.mkdir(parents=True)
    results = []
    metadata = {
        "ref": args.ref,
        "sourceSHA": ref,
        "node": node,
        "bun": bun,
        "command": command,
        "cacheDir": str(cache_dir),
        "replicas": 3,
        "platform": platform.platform(),
        "cpuQuota": optional_text(Path("/sys/fs/cgroup/cpu.max")),
        "memoryLimit": optional_text(Path("/sys/fs/cgroup/memory.max")),
        "coldDefinition": "Delete both project .tsbuildinfo files; OS page cache is not flushed",
        "helperSHA256": sha256(Path(__file__).read_bytes()),
    }
    write_json(output / "metadata.json", metadata)
    with tempfile.TemporaryDirectory(prefix="elogistix-typecheck-", dir="/tmp") as temporary:
        temp = Path(temporary)
        root = temp / "checkout"
        root.mkdir()
        archive = temp / "source.tar"
        subprocess.run(
            ["git", "archive", "--format=tar", f"--output={archive}", ref],
            cwd=repo, env=env, check=True, shell=False,
        )
        with tarfile.open(archive) as source_archive:
            source_archive.extractall(root, filter="data")
        install_command = ["bun", "install", "--frozen-lockfile", "--ignore-scripts"]
        with (output / "install.log").open("w") as log:
            install = subprocess.run(
                install_command, cwd=root, env=env, stdout=log,
                stderr=subprocess.STDOUT, shell=False, timeout=1200,
            )
        metadata["install"] = {
            "command": install_command,
            "exitCode": install.returncode,
            "logSHA256": sha256((output / "install.log").read_bytes()),
        }
        write_json(output / "metadata.json", metadata)
        if install.returncode:
            raise RuntimeError("Frozen installation failed; inspect install.log")
        typescript = json.loads((root / "node_modules/typescript/package.json").read_text())["version"]
        if typescript != "6.0.3":
            raise ValueError(f"Expected installed TypeScript 6.0.3; got {typescript}")
        source = root / SOURCE
        original = source.read_bytes()
        if original.count(BEFORE) != 1:
            raise ValueError("Equivalent tcValido body mutation no longer matches this ref")
        changed = original.replace(BEFORE, AFTER, 1)
        caches = [root / cache_dir / name for name in CACHE_NAMES]
        inputs = [Path("package.json"), Path("bun.lock"), *(
            config.relative_to(root) for config in sorted(root.glob("tsconfig*.json"))
        )]
        runner = Path("scripts/ci/typecheck-incremental.mjs")
        if (root / runner).is_file():
            inputs.append(runner)
        metadata.update({
            "typescript": typescript,
            "inputSHA256": {str(path): sha256((root / path).read_bytes()) for path in inputs},
            "incrementalChange": {
                "path": str(SOURCE),
                "before": BEFORE.decode(),
                "after": AFTER.decode(),
                "originalSHA256": sha256(original),
                "changedSHA256": sha256(changed),
                "publicSignatureChanged": False,
            },
        })
        write_json(output / "metadata.json", metadata)

        def measure(replica, phase):
            log_path = output / f"{replica}-{phase}.log"
            before = snapshot(caches, root)
            started = time.perf_counter()
            with log_path.open("w") as log:
                try:
                    result = subprocess.run(
                        command, cwd=root, env=env, stdout=log,
                        stderr=subprocess.STDOUT, shell=False, timeout=1200,
                    )
                    exit_code = result.returncode
                except subprocess.TimeoutExpired:
                    log.write("\nBenchmark timeout after 1200 seconds.\n")
                    exit_code = 124
            record = {
                "replica": replica, "phase": phase,
                "seconds": round(time.perf_counter() - started, 4),
                "exitCode": exit_code,
                "cacheBefore": before, "cacheAfter": snapshot(caches, root),
                "sourceSHA256": sha256(source.read_bytes()),
                "sourceMtimeNs": source.stat().st_mtime_ns,
                "log": log_path.name, "logSHA256": sha256(log_path.read_bytes()),
            }
            results.append(record)
            write_json(output / "results.json", results)
            print(json.dumps({key: record[key] for key in ("replica", "phase", "seconds", "exitCode")}), flush=True)
            if exit_code:
                raise RuntimeError(f"Typecheck failed in replica {replica}, phase {phase}")
            if not all(cache.is_file() for cache in caches):
                raise RuntimeError("Both configured .tsbuildinfo files must exist after typecheck")

        try:
            for replica in range(1, 4):
                source.write_bytes(original)
                for cache in caches:
                    cache.unlink(missing_ok=True)
                measure(replica, "cold")
                measure(replica, "warm")
                with tarfile.open(output / f"{replica}-clean-cache.tar", "w") as cache_archive:
                    for cache in caches:
                        cache_archive.add(cache, arcname=str(cache.relative_to(root)))
                source.write_bytes(changed)
                measure(replica, "incremental")
        finally:
            source.write_bytes(original)
    metadata["completed"] = True
    write_json(output / "metadata.json", metadata)
    print(f"Evidence: {output}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"Benchmark stopped: {error}", file=sys.stderr)
        raise SystemExit(1) from error
