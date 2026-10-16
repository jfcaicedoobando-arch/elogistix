#!/usr/bin/env python3
"""Scan final changed blobs, independently of the action's history traversal."""

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


class CoverageError(RuntimeError):
    """Fail closed without including file contents or subprocess output."""


def isolated_git_env():
    # -C alone cannot override inherited GIT_DIR/index/object/config redirections.
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull, GIT_TERMINAL_PROMPT="0")
    return env


def git(repo, *args, ok=(0,)):
    result = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, check=False,
        env=isolated_git_env(),
    )
    if result.returncode not in ok:
        raise CoverageError("Git could not verify the snapshot; no empty fallback.")
    return result


def commit(repo, value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-fA-F]{40}", value):
        raise CoverageError("Missing or malformed event commit SHA.")
    return git(repo, "rev-parse", "--verify", value + "^{commit}").stdout.decode().strip()


def endpoints(repo, event_name, event, github_sha):
    if event_name == "pull_request":
        pr = event.get("pull_request", {})
        head = commit(repo, pr.get("head", {}).get("sha"))
        base = commit(repo, pr.get("base", {}).get("sha"))
        base = git(repo, "merge-base", base, head).stdout.decode().strip()
        return commit(repo, base), head
    if event_name == "push":
        head = commit(repo, event.get("after"))
        before = event.get("before")
        return (None if before == "0" * 40 else commit(repo, before)), head
    if event_name == "workflow_dispatch":
        return None, commit(repo, github_sha)
    raise CoverageError("Unsupported event; no empty fallback.")


def tree(repo, head):
    entries = {}
    for entry in git(repo, "ls-tree", "-r", "-z", "--full-tree", head).stdout.split(b"\0"):
        if not entry:
            continue
        metadata, raw_path = entry.split(b"\t", 1)
        path = os.fsdecode(raw_path)
        # Paths become regular files under a private temporary directory.
        if any(part in ("", ".", "..", ".git") for part in path.split("/")):
            raise CoverageError("Unsafe snapshot path.")
        entries[path] = metadata.decode("ascii").split()
    return entries


def select_paths(repo, base, head, entries):
    if base is None:
        return list(entries), 0
    raw = git(
        repo, "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--ignore-submodules=none",
        "--name-status", "-z", base, head, "--",
    ).stdout
    changed = git(
        repo, "diff", "--no-ext-diff", "--no-textconv", "--ignore-submodules=none",
        "--quiet", base, head, "--",
        ok=(0, 1),
    ).returncode == 1
    if changed != bool(raw):
        raise CoverageError("Changed tree produced an inconsistent empty selection.")
    fields = raw.split(b"\0")
    if fields.pop() != b"" or len(fields) % 2:
        raise CoverageError("Malformed NUL-delimited change list.")
    selected, deleted = [], 0
    for index in range(0, len(fields), 2):
        status, raw_path = fields[index:index + 2]
        path = os.fsdecode(raw_path)
        if status == b"D":
            if path in entries:
                raise CoverageError("Deleted path unexpectedly remains in the head.")
            deleted += 1
        elif status in (b"A", b"M", b"T") and path in entries:
            selected.append(path)
        else:
            raise CoverageError("Unsupported or missing changed path.")
    if len(selected) != len(set(selected)):
        raise CoverageError("Duplicate changed path.")
    return selected, deleted


def blob(repo, entry):
    mode, kind, oid = entry
    if kind != "blob" or mode not in ("100644", "100755", "120000"):
        raise CoverageError("Changed submodules or unsupported objects require a separate review.")
    return git(repo, "cat-file", "blob", oid).stdout


def materialize(repo, entries, paths, destination):
    total = 0
    for path in paths:
        data = blob(repo, entries[path])
        target = destination / path
        target.parent.mkdir(parents=True, exist_ok=True)
        # A Git symlink is scanned as its literal target text, never followed.
        target.write_bytes(data)
        total += len(data)
    files = [path for path in destination.rglob("*") if path.is_file()]
    if len(files) != len(paths) or sum(path.stat().st_size for path in files) != total:
        raise CoverageError("Incomplete snapshot materialization.")
    return total


def quoted_path(path):
    # fast-import accepts Git C-style quoting; octal preserves arbitrary path bytes.
    return b'"' + b"".join(
        bytes([byte]) if 32 <= byte < 127 and byte not in (34, 92)
        else f"\\{byte:03o}".encode("ascii") for byte in os.fsencode(path)
    ) + b'"'


def snapshot_repository(root, entries, paths, source):
    shadow = root / "snapshot.git"
    git(root, "init", "--bare", "--quiet", "--template=", "--object-format=sha1",
        "--initial-branch=snapshot", str(shadow))
    stream = root / "snapshot.import"
    with stream.open("wb") as output:
        for index, path in enumerate(paths, 1):
            data = (source / path).read_bytes()
            output.write(f"blob\nmark :{index}\ndata {len(data)}\n".encode("ascii"))
            output.write(data)
            output.write(b"\n")
        message = b"Final snapshot scan\n"
        output.write(b"commit refs/heads/snapshot\n"
                     b"committer Snapshot Scan <snapshot@example.invalid> 0 +0000\n")
        output.write(f"data {len(message)}\n".encode("ascii") + message)
        for index, path in enumerate(paths, 1):
            output.write(f"M {entries[path][0]} :{index} ".encode("ascii")
                         + quoted_path(path) + b"\n")
        output.write(b"\ndone\n")
    with stream.open("rb") as source_stream:
        imported = subprocess.run(
            ["git", "-C", str(shadow), "fast-import", "--quiet", "--date-format=raw", "--done"],
            stdin=source_stream, capture_output=True, check=False, env=isolated_git_env(),
        )
    if imported.returncode:
        raise CoverageError("Could not construct the private snapshot history.")
    head = git(shadow, "rev-parse", "HEAD").stdout.decode().strip()
    if tree(shadow, head) != {path: entries[path] for path in paths}:
        raise CoverageError("Snapshot path, mode or blob identity changed.")
    if git(shadow, "rev-list", "--parents", "-n", "1", head).stdout.split() != [head.encode()]:
        raise CoverageError("Snapshot must contain exactly one root commit.")
    return shadow, head



def finding_metadata(report, selected_paths):
    """Return bounded known-rule locations; never copy arbitrary report fields."""
    # This diagnostic targets the suspected default rule. Other rules stay private.
    allowed_rules = frozenset(("generic-api-key",))
    allowed_paths = {
        path for path in selected_paths
        if isinstance(path, str) and len(path) <= 240
        and re.fullmatch(r"[A-Za-z0-9_./-]+", path)
        and all(part not in ("", ".", "..") for part in path.split("/"))
    }
    try:
        if report.is_symlink():
            return []
        with report.open("rb") as source:
            payload = source.read(1_048_577)
        if len(payload) > 1_048_576:
            return []
        findings = json.loads(payload)
    except (OSError, ValueError, RecursionError):
        return []
    if not isinstance(findings, list):
        return []
    locations = set()
    for item in findings[:10_000]:
        if not isinstance(item, dict):
            continue
        rule, path, line = item.get("RuleID"), item.get("File"), item.get("StartLine")
        if not isinstance(rule, str) or rule not in allowed_rules:
            continue
        if not isinstance(path, str) or path not in allowed_paths:
            continue
        if type(line) is not int or not 1 <= line <= 10_000_000:
            continue
        locations.add((path, rule, line))
        if len(locations) == 20:
            break
    return [f"Finding location: path={path}; rule={rule}; line={line}"
            for path, rule, line in sorted(locations)]


def scan(repo, event_name, event, github_sha, binary="gitleaks"):
    base, head = endpoints(repo, event_name, event, github_sha)
    entries = tree(repo, head)
    paths, deleted = select_paths(repo, base, head, entries)
    executable = shutil.which(binary)
    if not executable:
        raise CoverageError("The action-installed Gitleaks binary is unavailable.")
    executable = str(Path(executable).resolve())
    version = subprocess.run([executable, "version"], capture_output=True, check=False)
    if version.returncode or version.stdout.strip() != b"8.24.3":
        raise CoverageError("Snapshot validation requires the pinned Gitleaks 8.24.3.")
    with tempfile.TemporaryDirectory(prefix="gitleaks-snapshot-") as temp:
        root = Path(temp)
        source = root / "source"
        source.mkdir()
        total = materialize(repo, entries, paths, source)
        print(f"Snapshot: head={head}, files={len(paths)}, bytes={total}, deleted={deleted}")
        if not paths or not total:
            print("No final content: verified empty/deletion-only/zero-byte snapshot.")
            return 0
        config_entry = entries.get(".gitleaks.toml")
        if not config_entry or config_entry[0] not in ("100644", "100755"):
            raise CoverageError("Missing regular Gitleaks configuration in the head.")
        config = root / "gitleaks.toml"
        config.write_bytes(blob(repo, config_entry))
        ignore = root / ".gitleaksignore"
        if ".gitleaksignore" in entries:
            if entries[".gitleaksignore"][0] not in ("100644", "100755"):
                raise CoverageError("Gitleaks ignore configuration must be a regular file.")
            ignore.write_bytes(blob(repo, entries[".gitleaksignore"]))
        else:
            ignore.write_bytes(b"")
        # One root patch gives literal file paths without walking/pruning directories.
        # Plumbing copies exact bytes without clean filters, hooks, signing or credentials.
        shadow, snapshot_head = snapshot_repository(root, entries, paths, source)
        report = root / "findings.json"
        result = subprocess.run(
            [executable, "git", "--config", str(config),
             "--gitleaks-ignore-path", str(ignore), "--redact=100", "--no-banner",
             "--no-color", "--exit-code=2", "--log-level=info",
             "--report-format=json", "--report-path", str(report),
             "--log-opts=--root --text --no-ext-diff --no-textconv -1 " + snapshot_head,
             str(shadow)],
            cwd=root, capture_output=True, check=False, env=isolated_git_env(),
        )
        # Never print captured output, matches, secrets, descriptions or scanner errors.
        # The temporary report is never uploaded and is removed on every exit.
        output = result.stdout + result.stderr
        # 8.24.3: "scanned ~30544 bytes (30.54 KB)"; parentheses are human units.
        counts = re.findall(rb"scanned ~(\d+) bytes \([^\r\n()]+\)", output)
        commits = re.findall(rb"\b(\d+) commits scanned\.", output)
        if result.returncode:
            if result.returncode == 2:
                for location in finding_metadata(report, paths):
                    print(location)
            raise CoverageError(f"Snapshot scanner failed (exit {result.returncode}); inspect privately.")
        if len(counts) != 1:
            raise CoverageError("Scanner did not confirm its byte coverage.")
        if commits != [b"1"]:
            raise CoverageError("Scanner did not confirm the single root commit.")
        if int(counts[0]) == 0:
            raise CoverageError("Nonempty root snapshot unexpectedly scanned zero bytes.")
        print(f"Gitleaks: scanned_bytes={int(counts[0])}; no findings.")
        return 0


if __name__ == "__main__":
    try:
        with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as source:
            event = json.load(source)
        scan(Path.cwd(), os.environ["GITHUB_EVENT_NAME"], event, os.environ.get("GITHUB_SHA"))
    except (CoverageError, OSError, KeyError, ValueError) as error:
        # Built-in errors may contain unsafe paths or bytes; expose only our messages.
        message = str(error) if isinstance(error, CoverageError) else "Snapshot input or execution failed."
        print(f"::error::{message}")
        raise SystemExit(1)
