"""Protected pilot entry and native-bootstrap recipe, for reviewed VM assembly.

This module prepares and inspects *data*. It does not authorize a pilot, protect
an editable checkout by executing it, or implement a runtime/evidence verifier.
Before any privileged Python instruction, an independently trusted installer
must protect and inventory this file, the interpreter and its startup libraries.
Nothing returned by these review helpers is a substitute for that bootstrap.

The existing central main owns preflight, RuntimeDistribution, native custody,
and cleanup. Only its reviewed evidence_sink/abort_requested hooks may be used.
There is no process launch, service creation, privilege change or sudo policy.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
from types import MappingProxyType
from collections.abc import Mapping

INVENTORY_SCHEMA = "elogistix.protected-pilot.inventory.v1"
MAX_INVENTORY_BYTES = 65_536
MAX_FILES = 128
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_TREE_BYTES = 8 * 1024 * 1024
INVENTORY_NAME = "inventory.json"
CLOSED_INVOCATION_INVENTORY_NAME = "invocation-inventory.json"
PRODUCTION_BLOCKERS = (
    "EXTERNAL_PRE_PYTHON_BOOTSTRAP_NOT_REVIEWED",
    "PROTECTED_WRAPPER_AND_SCOPE_AUTHORIZATION_NOT_INSTALLED",
    "COMPLETE_APPROVED_CENTRAL_PACKAGE_NOT_INSTALLED",
    "PROTECTED_INTERPRETER_STDLIB_AND_EXTENSION_CLOSURE_NOT_BOUND",
    "LOAD_IDENTITY_AND_ADMINISTRATIVE_CHANNELS_NOT_OBSERVED",
    "FRESH_PRIVATE_LEDGER_AND_PHYSICAL_SEPARATION_NOT_OBSERVED",
    "AUXILIARY_BUDGET_NOT_MEASURED",
)
REVIEWED_WRAPPER_V71_SHA256 = "2f6d7079861262859a95752f6d62d6560e835e182dbaee9d6522fa9631d6a1b9"
REVIEWED_WRAPPER_V8_SHA256 = "3f49b50ae37679334b2c439ecdefec252071f54646c16b2c90337137014d9983"
REVIEWED_WRAPPER_V9_SHA256 = "a7c3d0ddca8d10047426da8ba591169fe0387baf531882def3a44386bbaf4208"
# Linux review found that this exact owner snapshot did not share the one-shot
# latch between supervise_bound and invoke/invoke_bound. Never import it in the
# production route while waiting for the independently reviewed owner delta.
REJECTED_SUPERVISOR_SHA256 = frozenset((REVIEWED_WRAPPER_V8_SHA256,))
ROLE_EXTENSIONS = {"python": ".py", "spec": ".json", "scope": "", "elf": "", "data": ""}
ACL_XATTRS = frozenset(("system.posix_acl_access", "system.posix_acl_default",
                       "system.nfs4_acl", "system.richacl", "security.capability"))


class BootstrapError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _require(ok, code):
    if not ok:
        raise BootstrapError(code)


def _sha(value):
    _require(type(value) is str and re.fullmatch("[0-9a-f]{64}", value) is not None,
             "SHA256_SYNTAX")
    return value


def _relative(value):
    _require(type(value) is str and 0 < len(value) <= 1024, "RELATIVE_PATH")
    _require(re.fullmatch(r"[A-Za-z0-9_.\-/]+", value) is not None,
             "RELATIVE_PATH")
    parts = value.split("/")
    _require(len(parts) <= 16 and all(p not in ("", ".", "..") for p in parts),
             "RELATIVE_PATH")
    _require(all(not p.endswith(".") and re.fullmatch(
        r"(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", p) is None
        for p in parts), "PORTABLE_PATH")
    _require("__pycache__" not in parts and not value.endswith((".pyc", ".pyo")),
             "BYTECODE_FORBIDDEN")
    return value


def _absolute(value):
    _require(type(value) is str and value.startswith("/") and value != "/",
             "ABSOLUTE_POSIX_PATH")
    _relative(value[1:])
    _require(str(PurePosixPath(value)) == value, "ABSOLUTE_POSIX_PATH")
    return value


def _uint(value):
    _require(type(value) is int and 0 <= value < (1 << 32), "IDENTITY_INTEGER")
    return value


@dataclass(frozen=True)
class FileEntry:
    path: str
    sha256: str
    size: int
    role: str


@dataclass(frozen=True)
class Inventory:
    """Hash-bound data inventory; not a certificate of installation or authority."""
    raw: bytes
    sha256: str
    files: tuple[FileEntry, ...]
    name: str = INVENTORY_NAME


def parse_inventory(raw: bytes, *, expected_sha256: str,
                    inventory_name: str = INVENTORY_NAME) -> Inventory:
    """Parse closed, bounded JSON only after verifying the externally pinned hash."""
    _sha(expected_sha256)
    _require(inventory_name in (INVENTORY_NAME, CLOSED_INVOCATION_INVENTORY_NAME)
             and type(inventory_name) is str, "INVENTORY_NAME")
    _require(type(raw) is bytes and 0 < len(raw) <= MAX_INVENTORY_BYTES,
             "INVENTORY_BYTES")
    _require(hashlib.sha256(raw).hexdigest() == expected_sha256, "INVENTORY_HASH")

    def pairs(items):
        value = {}
        for key, item in items:
            _require(key not in value, "DUPLICATE_JSON_KEY")
            value[key] = item
        return value

    def integer(token):
        _require(len(token) <= 10, "JSON_INTEGER_BOUND")
        return int(token)

    def forbidden(_):
        raise BootstrapError("JSON_NONINTEGER")

    try:
        data = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=pairs,
                          parse_int=integer, parse_float=forbidden,
                          parse_constant=forbidden)
    except BootstrapError:
        raise
    except (UnicodeError, ValueError, RecursionError) as exc:
        raise BootstrapError("INVENTORY_JSON") from exc
    _require(type(data) is dict and set(data) == {"schema", "files"}, "INVENTORY_KEYS")
    _require(data["schema"] == INVENTORY_SCHEMA, "INVENTORY_SCHEMA")
    _require(type(data["files"]) is list and 0 < len(data["files"]) <= MAX_FILES,
             "INVENTORY_FILE_COUNT")
    entries, paths, total = [], [], 0
    for entry in data["files"]:
        _require(type(entry) is dict and set(entry) == {"path", "sha256", "size", "role"},
                 "ENTRY_KEYS")
        path = _relative(entry["path"])
        _require(path.casefold() != inventory_name
                 and not path.casefold().startswith(inventory_name + "/"),
                 "INVENTORY_SELF_REFERENCE")
        role = entry["role"]
        _require(type(role) is str and role in ROLE_EXTENSIONS, "ENTRY_ROLE")
        extension = ROLE_EXTENSIONS[role]
        _require(not extension or path.endswith(extension), "ENTRY_EXTENSION")
        _require(role == "python" or not path.endswith(".py"), "PYTHON_ROLE")
        size = entry["size"]
        _require(type(size) is int and 0 <= size <= MAX_FILE_BYTES, "ENTRY_SIZE")
        _require(size > 0 or role in ("python", "data"), "EMPTY_EXECUTION_INPUT")
        total += size
        _require(total <= MAX_TREE_BYTES, "TREE_SIZE")
        paths.append(path)
        entries.append(FileEntry(path, _sha(entry["sha256"]), size, role))
    _require(paths == sorted(set(paths)), "PATHS_NOT_SORTED_OR_DUPLICATE")
    _require(len({p.casefold() for p in paths}) == len(paths), "PATH_CASE_ALIAS")
    directory_spellings = {}
    for path in paths:
        parts = path.split("/")
        for depth in range(1, len(parts)):
            prefix = "/".join(parts[:depth])
            folded = prefix.casefold()
            _require(directory_spellings.get(folded, prefix) == prefix, "DIRECTORY_CASE_ALIAS")
            directory_spellings[folded] = prefix
    for path in paths:
        _require(not any(other.casefold().startswith(path.casefold() + "/") for other in paths),
                 "FILE_DIRECTORY_COLLISION")
    return Inventory(raw, expected_sha256, tuple(entries), inventory_name)


def prepare_data(inventory: Inventory, blobs: Mapping[str, bytes]) -> Mapping[str, bytes]:
    """Copy validated bytes into an immutable map; never import or execute them."""
    _require(type(inventory) is Inventory, "INVENTORY_REQUIRED")
    # Reparse: constructing the public dataclass cannot bypass its closed schema.
    checked = parse_inventory(inventory.raw, expected_sha256=inventory.sha256,
                              inventory_name=inventory.name)
    _require(inventory == checked, "INVENTORY_CHANGED")
    _require(isinstance(blobs, Mapping) and set(blobs) == {f.path for f in checked.files},
             "UNINVENTORIED_OR_MISSING_FILE")
    result = {checked.name: checked.raw}
    for entry in checked.files:
        blob = blobs[entry.path]
        _require(type(blob) is bytes and len(blob) == entry.size, "FILE_SIZE")
        _require(hashlib.sha256(blob).hexdigest() == entry.sha256, "FILE_HASH")
        result[entry.path] = blob
    return MappingProxyType(result)


@dataclass(frozen=True)
class NodeObservation:
    """Observed POSIX metadata for pure tests; caller-supplied facts grant no authority."""
    path: str
    kind: str
    uid: int
    mode: int
    nlink: int
    acl_checked: bool
    acl_names: tuple[str, ...] = ()
    content: bytes | None = None


def check_node(node: NodeObservation, *, control_uid: int) -> None:
    _uint(control_uid)
    _require(type(node) is NodeObservation, "NODE_REQUIRED")
    _require(type(node.uid) is int and node.uid == control_uid, "CONTROL_OWNER")
    _require(node.kind in ("directory", "file"), "SYMLINK_OR_SPECIAL_NODE")
    _require(type(node.mode) is int and 0 <= node.mode <= 0o7777, "MODE_INVALID")
    _require(not node.mode & 0o7022, "WRITABLE_OR_SPECIAL_MODE")
    _require(node.acl_checked is True, "ACL_UNOBSERVED")
    _require(type(node.acl_names) is tuple and not node.acl_names, "ACL_FORBIDDEN")
    _require(type(node.nlink) is int and node.nlink > 0, "LINK_COUNT")
    _require(node.kind != "file" or node.nlink == 1, "FILE_HARDLINK")


def _directories(root: str, paths) -> set[str]:
    directories = {"/"}
    directories.update(str(p) for p in (PurePosixPath(root), *PurePosixPath(root).parents))
    for path in paths:
        directories.update(str(p) for p in PurePosixPath(root + "/" + path).parents)
    return directories


def check_tree_observations(root: str, inventory: Inventory,
                            observations: tuple[NodeObservation, ...], *, control_uid: int):
    """Hermetic closure check, including every ancestor to / and the pinned inventory.

    This verifies data consistency only. Production must use descriptor observations
    from a protected installation, not a caller's invented snapshots.
    """
    _absolute(root)
    checked = parse_inventory(inventory.raw, expected_sha256=inventory.sha256,
                              inventory_name=inventory.name)
    _require(inventory == checked, "INVENTORY_CHANGED")
    _require(type(observations) is tuple and len(observations) <= MAX_FILES * 17 + 17,
             "OBSERVATION_BOUND")
    entries = {root + "/" + f.path: f for f in checked.files}
    files = set(entries) | {root + "/" + checked.name}
    directories = _directories(root, (f.path for f in checked.files))
    by_path = {}
    for node in observations:
        _require(type(node) is NodeObservation and type(node.path) is str,
                 "NODE_REQUIRED")
        _require(node.path not in by_path, "DUPLICATE_OBSERVATION")
        by_path[node.path] = node
    _require(set(by_path) == files | directories, "UNINVENTORIED_OR_MISSING_NODE")
    for path, node in by_path.items():
        check_node(node, control_uid=control_uid)
        _require(node.kind == ("file" if path in files else "directory"), "NODE_KIND")
        if path in files:
            if path == root + "/" + checked.name:
                _require(node.content == checked.raw, "INVENTORY_HASH")
            else:
                entry = entries[path]
                _require(type(node.content) is bytes and len(node.content) == entry.size,
                         "FILE_SIZE")
                _require(hashlib.sha256(node.content).hexdigest() == entry.sha256, "FILE_HASH")
    return checked


def _stat_identity(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_gid,
            info.st_nlink, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def _observe_fd(fd: int, path: str, kind: str, *, control_uid: int, content=None):
    before = os.fstat(fd)
    _require((stat.S_ISDIR(before.st_mode) if kind == "directory"
              else stat.S_ISREG(before.st_mode)), "SYMLINK_OR_SPECIAL_NODE")
    try:
        names = os.listxattr(fd)
    except (OSError, AttributeError) as exc:
        raise BootstrapError("ACL_UNOBSERVED") from exc
    node = NodeObservation(path, kind, before.st_uid, stat.S_IMODE(before.st_mode),
                           before.st_nlink, True,
                           tuple(sorted(set(names) & ACL_XATTRS)), content)
    check_node(node, control_uid=control_uid)
    return node, _stat_identity(before)


def _read_posix_tree(root: str, inventory: Inventory, *, control_uid: int = 0):
    """Read only, descriptor-anchored inspection; no chmod, chown, ACL changes or imports.

    Reject all POSIX ACLs conservatively, including read-only ACLs. No path is
    resolved through a symlink. Stable control ownership is an operator assumption;
    an administrator racing this operation is outside the supported scope.
    """
    _require(sys.platform == "linux", "PLATFORM_NOT_SUPPORTED")
    _absolute(root)
    _uint(control_uid)
    checked = parse_inventory(inventory.raw, expected_sha256=inventory.sha256,
                              inventory_name=inventory.name)
    _require(inventory == checked, "INVENTORY_CHANGED")
    _require(hasattr(os, "O_NOFOLLOW") and hasattr(os, "O_DIRECTORY"),
             "DESCRIPTOR_API_REQUIRED")
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    file_flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK
    observations, retained = [], []
    entries = {f.path: f for f in checked.files}
    expected_files = set(entries) | {checked.name}
    expected_directories = {""}
    for path in entries:
        expected_directories.update(str(p) for p in PurePosixPath(path).parents if str(p) != ".")
    try:
        fd = os.open("/", directory_flags)
        retained.append(fd)
        path = "/"
        node, identity = _observe_fd(fd, path, "directory", control_uid=control_uid)
        observations.append(node)
        ancestors = [(fd, identity)]
        for part in root[1:].split("/"):
            child = os.open(part, directory_flags, dir_fd=fd)
            retained.append(child)
            fd = child
            path = (path.rstrip("/") + "/" + part)
            node, identity = _observe_fd(fd, path, "directory", control_uid=control_uid)
            observations.append(node)
            ancestors.append((fd, identity))

        def walk(directory_fd, relative):
            _, before = _observe_fd(directory_fd, root + ("/" + relative if relative else ""),
                                    "directory", control_uid=control_uid)
            names = os.listdir(directory_fd)
            # A valid inventory also creates its own pinned inventory.json file.
            _require(len(names) <= MAX_FILES + 1, "DIRECTORY_ENTRY_BOUND")
            for name in sorted(names):
                child_relative = relative + "/" + name if relative else name
                _relative(child_relative)
                is_directory = child_relative in expected_directories
                _require(is_directory or child_relative in expected_files,
                         "UNINVENTORIED_OR_MISSING_NODE")
                flags = directory_flags if is_directory else file_flags
                child = os.open(name, flags, dir_fd=directory_fd)
                try:
                    full_path = root + "/" + child_relative
                    kind = "directory" if is_directory else "file"
                    node, identity = _observe_fd(child, full_path, kind, control_uid=control_uid)
                    if is_directory:
                        observations.append(node)
                        walk(child, child_relative)
                    else:
                        maximum = len(checked.raw) if child_relative == checked.name else entries[child_relative].size
                        _require(os.fstat(child).st_size == maximum, "FILE_SIZE")
                        chunks, size = [], 0
                        while size <= maximum:
                            chunk = os.read(child, min(65_536, maximum + 1 - size))
                            if not chunk:
                                break
                            chunks.append(chunk)
                            size += len(chunk)
                        _require(size == maximum, "FILE_SIZE")
                        observations.append(NodeObservation(node.path, node.kind, node.uid,
                            node.mode, node.nlink, node.acl_checked, node.acl_names, b"".join(chunks)))
                    _require(_stat_identity(os.fstat(child)) == identity, "NODE_CHANGED_DURING_READ")
                finally:
                    os.close(child)
            _require(_stat_identity(os.fstat(directory_fd)) == before, "NODE_CHANGED_DURING_READ")

        walk(fd, "")
        for ancestor, identity in ancestors:
            _require(_stat_identity(os.fstat(ancestor)) == identity, "ANCESTOR_CHANGED")
        check_tree_observations(root, checked, tuple(observations), control_uid=control_uid)
        return MappingProxyType({n.path[len(root) + 1:]: n.content for n in observations
                                 if n.kind == "file"})
    except BootstrapError:
        raise
    except OSError as exc:
        raise BootstrapError("PROTECTED_TREE_UNAVAILABLE") from exc
    finally:
        for opened in reversed(retained):
            os.close(opened)


def inspect_posix_tree(root: str, inventory: Inventory, *, control_uid: int = 0):
    _read_posix_tree(root, inventory, control_uid=control_uid)
    return parse_inventory(inventory.raw, expected_sha256=inventory.sha256,
                           inventory_name=inventory.name)


def write_review_data(destination: Path, inventory: Inventory, blobs: Mapping[str, bytes]):
    """Create a fresh local review tree as data, without claiming it is protected.

    Never use this unprivileged fixture writer as the installation boundary.
    The production gate rejects the resulting editable tree like any checkout.
    """
    payloads = prepare_data(inventory, blobs)
    _require(type(destination) in (Path, type(Path())), "DESTINATION_PATH")
    # Windows Python treats 0700 as a special ACL request. A review fixture is
    # editable data, so use inherited permissions there without changing ACLs.
    directory_mode = 0o700 if os.name == "posix" else 0o777
    destination.mkdir(mode=directory_mode, parents=False, exist_ok=False)
    for relative, blob in payloads.items():
        target = destination.joinpath(*relative.split("/"))
        target.parent.mkdir(mode=directory_mode, parents=True, exist_ok=True)
        with target.open("xb") as stream:
            stream.write(blob)
    return destination


@dataclass(frozen=True)
class LoadIdentity:
    uid: int
    gid: int
    supplementary_gids: tuple[int, ...]
    administrative_channels: tuple[str, ...]


def check_load_identity(identity: LoadIdentity, *, control_uid: int, forbidden_gids: tuple[int, ...]):
    """Validate observed identity data; creating/changing accounts is outside this launcher."""
    _require(type(identity) is LoadIdentity, "LOAD_IDENTITY_REQUIRED")
    _uint(control_uid)
    _uint(identity.uid)
    _uint(identity.gid)
    _require(identity.uid != 0 and identity.uid != control_uid, "LOAD_CONTROL_IDENTITY")
    _require(type(forbidden_gids) is tuple and all(type(g) is int for g in forbidden_gids)
             and 0 in forbidden_gids, "ADMIN_GROUP_POLICY")
    for gid in forbidden_gids:
        _uint(gid)
    _require(identity.gid not in forbidden_gids, "ADMIN_PRIMARY_GROUP")
    _require(identity.supplementary_gids == (), "SUPPLEMENTARY_GROUPS_FORBIDDEN")
    _require(identity.administrative_channels == (), "ADMINISTRATIVE_CHANNEL")
    return identity


@dataclass(frozen=True)
class InvocationPlan:
    """Concrete immutable review recipe. No token or Boolean opens production."""
    argv: tuple[str, ...]
    cwd: str
    environment: tuple[tuple[str, str], ...]
    sys_path: tuple[str, ...]
    ledger_directory: str
    central_argv: tuple[str, ...]
    blockers: tuple[str, ...]


def build_invocation_plan(*, root: str, interpreter: str, stdlib_paths: tuple[str, ...],
                          inventory: Inventory, entry_path: str, spec_path: str,
                          scope_path: str, source_elf_path: str, ledger_directory: str,
                          package_directory: str):
    """Design only: all paths absolute, inputs inventoried, ambient environment excluded.

    A freshly created ledger must also be observed for owner/mode/ACL, aliases,
    mounts and retained writable descriptors; lexical separation is only data.
    An external trusted bootstrap must inventory the interpreter's true executable,
    dynamic loader, stdlib, extensions and startup dependency closure before exec.
    -I/-S/-B cannot establish that closure. sys.path must be replaced, never appended,
    after trusted startup and before importing package or reviewed wrapper hooks.
    """
    _absolute(root)
    _absolute(interpreter)
    _absolute(ledger_directory)
    checked = parse_inventory(inventory.raw, expected_sha256=inventory.sha256)
    _require(inventory == checked, "INVENTORY_CHANGED")
    roles = {f.path: f.role for f in checked.files}
    _relative(package_directory)
    _require(roles.get(package_directory + "/systemd_memory_runtime/__main__.py") == "python",
             "CANONICAL_MAIN_NOT_INVENTORIED")
    for path, role in ((entry_path, "python"), (spec_path, "spec"),
                       (scope_path, "scope"), (source_elf_path, "elf")):
        _relative(path)
        _require(roles.get(path) == role, "INVOCATION_INPUT_NOT_INVENTORIED")
    _require(type(stdlib_paths) is tuple and 0 < len(stdlib_paths) <= 4,
             "STDLIB_PATHS_REQUIRED")
    for path in stdlib_paths:
        _absolute(path)
    _require(len(set(stdlib_paths)) == len(stdlib_paths), "DUPLICATE_STDLIB_PATH")
    def overlaps(a, b):
        return a == b or a.startswith(b + "/") or b.startswith(a + "/")
    _require(not overlaps(root, ledger_directory), "LEDGER_CONTROL_OVERLAP")
    _require(not overlaps(interpreter, ledger_directory)
             and not any(overlaps(path, ledger_directory) or overlaps(path, root)
                         for path in stdlib_paths), "STARTUP_CONTROL_OVERLAP")
    full = lambda path: root + "/" + path
    scope_hash = next(f.sha256 for f in checked.files if f.path == scope_path)
    argv = (interpreter, "-I", "-S", "-B", full(entry_path),
            "--inventory", full(INVENTORY_NAME), "--inventory-sha256", checked.sha256,
            "--spec", full(spec_path), "--source-elf", full(source_elf_path),
            "--approved-scope", full(scope_path), "--scope-sha256", scope_hash,
            "--ledger-directory", ledger_directory)
    return InvocationPlan(argv, root, (("LANG", "C.UTF-8"), ("LC_ALL", "C.UTF-8")),
                          stdlib_paths + (full(package_directory),), ledger_directory,
                          ("run", "--spec", full(spec_path), "--source-elf", full(source_elf_path)),
                          PRODUCTION_BLOCKERS)


ENTRY_PATH = "scripts/ci/systemd-pilot-protected-entry.py"
PACKAGE_DIRECTORY = "package"
WRAPPER_PATH = "package/invoke-systemd-synthetic-pilot.py"
SPEC_PATH = "data/run-spec.json"
RUN_INTENT_PATH = "data/run-intent.json"
RUN_INTENT_SCHEMA = "elogistix.protected-pilot.run-intent.v1"
SCOPE_PATH = "data/approved-scope.md"
CONTEXT_PATH = "data/event-context.json"
YAML_PATH = "data/workflow.yml"
SOURCE_MANIFEST_PATH = "data/source-manifest.json"
APPROVAL_PATH = "data/approval.json"
ELF_PATH = "data/keeper.elf"
APPROVAL_SCHEMA = "elogistix.protected-pilot.approval.v1"
SOURCE_SCHEMA = "elogistix.protected-pilot.sources.v1"
SOURCE_MANIFEST_KEYS = frozenset(("schema", "repository", "source_commit", "files"))
SOURCE_ENTRY_KEYS = frozenset(("path", "sha256", "size"))
REPOSITORY = "jfcaicedoobando-arch/elogistix"
EXPECTED_ENVIRONMENT = (("LANG", "C.UTF-8"), ("LC_ALL", "C.UTF-8"))
ADMINISTRATIVE_GROUP_NAMES = frozenset(("root", "sudo", "admin", "wheel", "docker",
    "lxd", "incus-admin", "libvirt", "disk", "kmem", "shadow", "systemd-journal"))
MAX_NATIVE_RECIPE_BYTES = 4 * 1024 * 1024
VM_INTERPRETER = "/usr/bin/python3.12"
VM_STDLIB_PATHS = ("/usr/lib/python3.12", "/usr/lib/python3.12/lib-dynload")
VM_ABSENT_STARTUP_ZIP = "/usr/lib/python312.zip"
VM_NATIVE_DEPENDENCIES = frozenset((
    "/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2",
    "/usr/lib/x86_64-linux-gnu/libc.so.6",
    "/usr/lib/x86_64-linux-gnu/libm.so.6",
))


def _strict_data(raw, *, maximum=MAX_INVENTORY_BYTES):
    """Only bootstrap metadata; runtime/scope schemas use the owner's parser."""
    _require(type(raw) is bytes and 0 < len(raw) <= maximum, "DATA_BYTES")
    def pairs(items):
        value = {}
        for key, item in items:
            _require(key not in value, "DUPLICATE_JSON_KEY")
            value[key] = item
        return value
    def integer(token):
        _require(len(token.lstrip("-")) <= 20, "JSON_INTEGER_BOUND")
        return int(token)
    def forbidden(_):
        raise BootstrapError("JSON_NONINTEGER")
    try:
        value = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=pairs,
            parse_int=integer, parse_float=forbidden, parse_constant=forbidden)
    except BootstrapError:
        raise
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise BootstrapError("DATA_JSON") from exc
    stack = [(value, 0)]
    while stack:
        item, depth = stack.pop()
        if type(item) in (dict, list):
            _require(depth < 8, "DATA_DEPTH")
            stack.extend((v, depth + 1) for v in (item.values() if type(item) is dict else item))
    return value


def _os_path(value):
    # Inventoried OS bytecode is allowed in the separately approved startup closure.
    _require(type(value) is str and value.startswith("/") and value != "/"
             and len(value) <= 1024 and re.fullmatch(r"/[A-Za-z0-9_.\-/]+", value)
             is not None and all(p not in ("", ".", "..") for p in value[1:].split("/")),
             "OS_PATH")
    return value


def _pin_entries(entries, *, maximum):
    _require(type(entries) is list and 0 < len(entries) <= maximum, "PIN_COUNT")
    result = []
    for item in entries:
        _require(type(item) is dict and set(item) == {"path", "sha256", "size"}, "PIN_KEYS")
        _os_path(item["path"])
        _sha(item["sha256"])
        _require(type(item["size"]) is int and 0 <= item["size"] <= 128 * 1024 * 1024,
                 "PIN_SIZE")
        result.append(item)
    _require([v["path"] for v in result] == sorted({v["path"] for v in result}), "PIN_PATHS")
    return result


def _parse_approval(raw, expected_sha256):
    _sha(expected_sha256)
    _require(type(raw) is bytes and hashlib.sha256(raw).hexdigest() == expected_sha256,
             "EXTERNAL_APPROVAL_HASH")
    value = _strict_data(raw, maximum=2 * 1024 * 1024)
    keys = {"schema", "repository", "source_commit", "branch", "authorization_ref",
            "scope_document_sha256", "yaml_sha256", "source_manifest_sha256", "elf_sha256",
            "event_context_sha256",
            "python_files", "interpreter", "stdlib_paths", "startup_files", "identity"}
    _require(type(value) is dict and set(value) == keys, "APPROVAL_KEYS")
    _require(value["schema"] == APPROVAL_SCHEMA and value["repository"] == REPOSITORY,
             "APPROVAL_IDENTITY")
    _require(type(value["source_commit"]) is str and re.fullmatch("[0-9a-f]{40}",
             value["source_commit"]) is not None and value["source_commit"] != "0" * 40,
             "SOURCE_COMMIT")
    for key in ("branch", "authorization_ref"):
        _require(type(value[key]) is str and 0 < len(value[key]) <= 255 and not
                 value[key].startswith("PENDING_") and not any(ord(c) < 32 for c in value[key]),
                 "APPROVAL_UNRESOLVED")
    for key in ("scope_document_sha256", "yaml_sha256", "source_manifest_sha256", "elf_sha256",
                "event_context_sha256"):
        _sha(value[key])
    files = value["python_files"]
    _require(type(files) is list and 0 < len(files) <= MAX_FILES, "PYTHON_PINS")
    for item in files:
        _require(type(item) is dict and set(item) == {"path", "sha256", "size"}, "PIN_KEYS")
        _relative(item["path"])
        _require(item["path"].endswith(".py"), "PYTHON_PIN_PATH")
        _sha(item["sha256"])
        _require(type(item["size"]) is int and 0 <= item["size"] <= MAX_FILE_BYTES, "PIN_SIZE")
    _require([v["path"] for v in files] == sorted({v["path"] for v in files}), "PIN_PATHS")
    _absolute(value["interpreter"])
    _require(type(value["stdlib_paths"]) is list and 0 < len(value["stdlib_paths"]) <= 4,
             "STDLIB_PATHS_REQUIRED")
    for path in value["stdlib_paths"]:
        _absolute(path)
    _require(len(set(value["stdlib_paths"])) == len(value["stdlib_paths"]), "DUPLICATE_STDLIB_PATH")
    _require(value["interpreter"] == VM_INTERPRETER and
             tuple(value["stdlib_paths"]) == VM_STDLIB_PATHS, "UNREVIEWED_VM_STARTUP_PROFILE")
    startup = _pin_entries(value["startup_files"], maximum=4096)
    _require(not any("/systemd_memory_runtime" in f["path"] for f in startup),
             "AMBIENT_RUNTIME_PACKAGE")
    _require(value["interpreter"] in {f["path"] for f in startup}, "INTERPRETER_NOT_PINNED")
    _require(VM_NATIVE_DEPENDENCIES <= {f["path"] for f in startup}, "NATIVE_STARTUP_DEPS_NOT_PINNED")
    _require(all(any(f["path"].startswith(p + "/") for f in startup)
                 for p in value["stdlib_paths"]), "STDLIB_NOT_PINNED")
    identity = value["identity"]
    _require(type(identity) is dict and set(identity) == {"uid", "gid", "name", "home",
             "shell", "policy_files", "policy_directories"}, "IDENTITY_POLICY_KEYS")
    _uint(identity["uid"])
    _uint(identity["gid"])
    _require(identity["uid"] > 0 and identity["gid"] > 0, "LOAD_CONTROL_IDENTITY")
    _require(type(identity["name"]) is str and re.fullmatch("[a-z_][a-z0-9_-]{0,31}",
             identity["name"]) is not None, "ACCOUNT_NAME")
    _absolute(identity["home"])
    _require(identity["shell"] in ("/usr/sbin/nologin", "/sbin/nologin", "/bin/false"),
             "LOAD_LOGIN_CHANNEL")
    policy = _pin_entries(identity["policy_files"], maximum=128)
    _require({"/etc/passwd", "/etc/group", "/etc/nsswitch.conf", "/etc/sudoers"} <=
             {f["path"] for f in policy}, "IDENTITY_POLICY_NOT_PINNED")
    _require(type(identity["policy_directories"]) is list and
             set(identity["policy_directories"]) == {"/etc/sudoers.d", "/etc/polkit-1/rules.d",
                 "/usr/share/polkit-1/rules.d", "/etc/pam.d", "/etc/security"},
             "IDENTITY_POLICY_DIRECTORIES")
    return value


def _validate_installation_pins(inventory, approval, *, pre_run=False, final=False):
    """A dynamic inventory hash is never approval for Python source bytes."""
    _require(type(pre_run) is bool and type(final) is bool and not (pre_run and final),
             "INSTALLATION_LAYOUT")
    _require(inventory.name == (CLOSED_INVOCATION_INVENTORY_NAME if final else INVENTORY_NAME),
             "INSTALLATION_INVENTORY_NAME")
    actual = [{"path": f.path, "sha256": f.sha256, "size": f.size}
              for f in inventory.files if f.role == "python"]
    _require(actual == approval["python_files"], "UNAPPROVED_PYTHON_SOURCE")
    required = {ENTRY_PATH: "python", WRAPPER_PATH: "python",
        (RUN_INTENT_PATH if pre_run else SPEC_PATH): ("data" if pre_run else "spec"),
        SCOPE_PATH: "scope", CONTEXT_PATH: "data", YAML_PATH: "data",
        SOURCE_MANIFEST_PATH: "data", APPROVAL_PATH: "data", ELF_PATH: "elf",
        "package/systemd_memory_runtime/__main__.py": "python",
        "package/systemd_memory_runtime/contracts.py": "python",
        "package/systemd_memory_runtime/payload_distribution.py": "python",
        "package/systemd_memory_runtime/physical_cgroup.py": "python"}
    if final:
        required.update({INVENTORY_NAME: "data", RUN_INTENT_PATH: "data"})
    entries = {f.path: f for f in inventory.files}
    _require(all(p in entries and entries[p].role == role for p, role in required.items()),
             "COMPLETE_COMPOSITION_NOT_INVENTORIED")
    allowed = set(required) | {f["path"] for f in approval["python_files"]}
    if "sources/keeper.c" in entries:
        _require(entries["sources/keeper.c"].role == "data", "KEEPER_SOURCE_ROLE")
        allowed.add("sources/keeper.c")
    _require(set(entries) == allowed, "UNAPPROVED_INSTALLATION_NODE")
    for entry in inventory.files:
        # A .so/.pth/data file must never enter Python's import search directory.
        _require(not entry.path.startswith(PACKAGE_DIRECTORY + "/") or entry.role == "python",
                 "NONPYTHON_IMPORT_ASSET")
        if entry.role == "python":
            _require(entry.path in (ENTRY_PATH, WRAPPER_PATH) or
                     re.fullmatch(r"package/systemd_memory_runtime/[A-Za-z0-9_]+[.]py", entry.path)
                     is not None, "PYTHON_LAYOUT")
    for path, key in ((SCOPE_PATH, "scope_document_sha256"), (YAML_PATH, "yaml_sha256"),
                      (SOURCE_MANIFEST_PATH, "source_manifest_sha256"), (ELF_PATH, "elf_sha256"),
                      (CONTEXT_PATH, "event_context_sha256")):
        _require(entries[path].sha256 == approval[key], "APPROVED_DATA_PIN")


PREPARATION_NATIVE_TOOLS = frozenset(("/usr/bin/dash", "/usr/bin/id", "/usr/bin/stat",
    "/usr/bin/getfattr", "/usr/bin/sha256sum", "/usr/bin/mkdir", "/usr/bin/mkfifo",
    "/usr/bin/timeout", "/usr/bin/dd", "/usr/bin/setpriv", "/usr/bin/rm",
    "/usr/bin/find", "/usr/bin/sort"))
RUN_INTENT_KEYS = frozenset(("schema", "run", "slots", "load_uid", "load_gid",
    "load_groups", "payload_expected_sha256", "cleanup_policy_id", "scope_ref"))


@dataclass(frozen=True)
class NativePreparationData:
    """Inert OS recipe for PRE-RUN assets, never a supplied/started RunSpec.

    The independently trusted VM executor pins these bytes, the first native
    image and its OS dependency closure; starts argv with env={} / cwd='/' and
    only stdin/script plus stdout/stderr pipes; and bounds preparation separately.
    No privileged Python or mutable checkout program runs in this phase.
    """
    bootstrap_argv: tuple[str, ...]
    stdin_script: bytes
    script_sha256: str
    environment: tuple[tuple[str, str], ...]
    cwd: str
    protected_source_directory: str
    inventory_sha256: str
    approval_sha256: str
    timing_boundary: str


def build_os_preparation_recipe(*, approval_raw: bytes, approval_sha256: str,
                                inventory_raw: bytes, inventory_sha256: str,
                                run_intent_raw: bytes, source_directory: str,
                                protected_source_directory: str,
                                reader_uid: int, reader_gid: int):
    """Seal only inventoried PRE-RUN data from a mutable ingress, as native DATA.

    A fixed unprivileged reader sees only a pipe, never the writable protected
    file. A separate root OS writer owns that file; both are waited/reaped before
    hashing it. An ancestor race in the mutable ingress can redirect the reader,
    but never a root read: this is content pinning, not source-path confinement.
    Root-private destination ancestors and new inodes remain mandatory.

    No t0 is read or invented here. After this phase and independent validation,
    produce_original_runspec in this protected entry reads the central clock
    ONCE to construct the original RunSpec. Final materialization, inventory,
    supervision and original-main/preflight work consume that same origin.
    This recipe cannot accept, renew or hide an already started RunSpec.
    """
    inventory = parse_inventory(inventory_raw, expected_sha256=inventory_sha256)
    approval = _parse_approval(approval_raw, approval_sha256)
    _validate_installation_pins(inventory, approval, pre_run=True)
    entries = {f.path: f for f in inventory.files}
    _require(entries[APPROVAL_PATH].sha256 == approval_sha256 and
             entries[APPROVAL_PATH].size == len(approval_raw), "APPROVAL_NOT_INVENTORIED")
    _require(type(run_intent_raw) is bytes and
             entries[RUN_INTENT_PATH].sha256 == hashlib.sha256(run_intent_raw).hexdigest()
             and entries[RUN_INTENT_PATH].size == len(run_intent_raw), "RUN_INTENT_HASH")
    intent = _strict_data(run_intent_raw)
    _require(type(intent) is dict and set(intent) == RUN_INTENT_KEYS and
             intent["schema"] == RUN_INTENT_SCHEMA, "PRE_RUN_INTENT_KEYS")
    _require(type(intent["run"]) is str and re.fullmatch("[0-9a-f]{32}", intent["run"])
             is not None, "PRE_RUN_INTENT_RUN")
    # These are pin/identity conflicts, not a second RunSpec/runtime verifier.
    # The existing canonical RunSpec still validates every semantic field.
    identity = approval["identity"]
    _require(type(intent["load_uid"]) is int and type(intent["load_gid"]) is int and
             intent["load_uid"] == identity["uid"] and intent["load_gid"] == identity["gid"]
             and type(intent["load_groups"]) is list and
             len(intent["load_groups"]) == 1 and type(intent["load_groups"][0]) is int and
             intent["load_groups"] == [identity["gid"]], "PRE_RUN_INTENT_IDENTITY")
    _require(intent["payload_expected_sha256"] == approval["elf_sha256"], "PRE_RUN_INTENT_ELF")
    for value in (reader_uid, reader_gid):
        # Linux's all-bits-one UID/GID is a "do not change" syscall sentinel.
        _require(type(value) is int and 0 < value < 0xFFFFFFFF, "INGRESS_READER_IDENTITY")
    for path in (source_directory, protected_source_directory):
        _absolute(path)
    def overlap(a, b):
        return a == b or a.startswith(b + "/") or b.startswith(a + "/")
    _require(not overlap(source_directory, protected_source_directory) and
             not any(overlap(protected_source_directory, p) for p in
                     (*approval["stdlib_paths"], approval["interpreter"], *PREPARATION_NATIVE_TOOLS)),
             "PREPARATION_PATH_OVERLAP")
    startup = {item["path"]: item for item in approval["startup_files"]}
    _require(PREPARATION_NATIVE_TOOLS <= set(startup), "PREPARATION_OS_TOOLS_NOT_PINNED")
    quote = lambda p: "'" + p.replace("'", "'\"'\"'") + "'"
    lines = ["set -eu", "umask 077", "export LANG=C LC_ALL=C", "die() { exit 3; }",
        "u=$(/usr/bin/id -u) || die", "[ \"$u\" = 0 ] || die",
        "node() {",
        "  [ ! -L \"$1\" ] || die",
        "  u=$(/usr/bin/stat -c %u -- \"$1\") || die", "  [ \"$u\" = 0 ] || die",
        "  m=$(/usr/bin/stat -c %a -- \"$1\") || die", "  [ $((0$m & 07022)) = 0 ] || die",
        "  a=$(/usr/bin/getfattr --absolute-names -d -m '^(system[.](posix_acl_access|posix_acl_default|nfs4_acl|richacl)|security[.]capability)$' -- \"$1\" 2>/dev/null) || die",
        "  [ -z \"$a\" ] || die", "}", "file() {", "  node \"$1\"",
        "  [ -f \"$1\" ] || die", "  l=$(/usr/bin/stat -c %h -- \"$1\") || die",
        "  [ \"$l\" = 1 ] || die", "  z=$(/usr/bin/stat -c %s -- \"$1\") || die",
        "  [ \"$z\" = \"$2\" ] || die", "  h=$(/usr/bin/sha256sum -- \"$1\") || die",
        "  [ \"${h%% *}\" = \"$3\" ] || die", "}",
        "[ ! -L '/dev/null' ] || die", "[ -c '/dev/null' ] || die",
        "[ ! -e '" + VM_ABSENT_STARTUP_ZIP + "' ] || die",
        "[ ! -L '" + VM_ABSENT_STARTUP_ZIP + "' ] || die"]
    checked, made = set(), set()
    def check_directories(path):
        for p in reversed((PurePosixPath(path), *PurePosixPath(path).parents)):
            text = str(p)
            if text not in checked:
                lines.extend(("node " + quote(text), "[ -d " + quote(text) + " ] || die"))
                checked.add(text)
    # Never impose protected-tree ownership on the mutable checkout or scan its
    # extras. Its bytes are read by the externally pinned nonzero UID/GID only.
    check_directories(str(PurePosixPath(protected_source_directory).parent))
    lines.append("/usr/bin/mkdir -m 0700 -- " + quote(protected_source_directory) + " || die")
    check_directories(protected_source_directory)
    pins = dict(startup)
    for item in identity["policy_files"]:
        _require(item["path"] not in pins or item == pins[item["path"]], "OS_PIN_CONFLICT")
        pins[item["path"]] = item
    for path, item in sorted(pins.items()):
        check_directories(str(PurePosixPath(path).parent))
        lines.append("file %s %d %s" % (quote(path), item["size"], quote(item["sha256"])))
    for directory in approval["stdlib_paths"] + identity["policy_directories"]:
        contained = {p for p in pins if p.startswith(directory + "/")}
        nodes = {directory, *contained}
        for path in contained:
            nodes.update(str(p) for p in PurePosixPath(path).parents
                         if str(p) == directory or str(p).startswith(directory + "/"))
        for path in sorted(nodes - contained):
            check_directories(path)
        lines.extend(("n=$(/usr/bin/find " + quote(directory) + " -print) || die",
                      "s=$(printf '%s\\n' \"$n\" | /usr/bin/sort) || die",
                      "[ \"$s\" = '" + "\n".join(sorted(nodes)) + "' ] || die"))
    # The recipe's reader IDs are independently pinned; also require an existing
    # account with that primary GID in the already approved local NSS profile.
    lines.extend(("u=$(/usr/bin/id -u -- %s) || die" % quote(str(reader_uid)),
                  "[ \"$u\" = %s ] || die" % quote(str(reader_uid)),
                  "g=$(/usr/bin/id -g -- %s) || die" % quote(str(reader_uid)),
                  "[ \"$g\" = %s ] || die" % quote(str(reader_gid))))
    payloads = [(INVENTORY_NAME, len(inventory.raw), inventory.sha256)]
    payloads.extend((f.path, f.size, f.sha256) for f in inventory.files)
    destination_nodes = {protected_source_directory}
    pipe = protected_source_directory + "/.ingress-copy.pipe"
    lines.append("set -C")
    for relative, size, expected in payloads:
        source = source_directory + "/" + relative
        target = protected_source_directory + "/" + relative
        parent = str(PurePosixPath(target).parent)
        for ancestor in reversed((PurePosixPath(parent), *PurePosixPath(parent).parents)):
            directory = str(ancestor)
            if directory.startswith(protected_source_directory + "/") and directory not in made:
                lines.append("/usr/bin/mkdir -m 0700 -- " + quote(directory) + " || die")
                made.add(directory)
                check_directories(directory)
        destination_nodes.add(target)
        destination_nodes.update(str(p) for p in PurePosixPath(target).parents
                                 if str(p).startswith(protected_source_directory + "/"))
        lines.extend(("/usr/bin/mkfifo -m 0600 -- " + quote(pipe) + " || die",
                      "node " + quote(pipe), "[ -p " + quote(pipe) + " ] || die"))
        # Redirect target ONLY in the root writer's background child. The parent
        # and low-privilege sibling never acquire its writable regular-file FD.
        lines.append("/usr/bin/timeout --kill-after=1 2 /usr/bin/dd if=%s iflag=nofollow,count_bytes count=%d bs=65536 status=none < /dev/null > %s &"
                     % (quote(pipe), size + 1, quote(target)))
        lines.append("writer=$!")
        # The outer timeout starts BEFORE the fixed root shell opens the FIFO;
        # an opening failure on the other side cannot block the parent shell.
        # The shell immediately execs setpriv/dd; no checkout code is executed.
        # Check the effective numeric identity again AFTER setpriv and BEFORE
        # dd opens any mutable source. A failed/ignored identity change cannot
        # become a root read, even if a tool version behaves unexpectedly.
        checked_read = ("u=$(/usr/bin/id -u) || exit 3; [ \"$u\" = %d ] || exit 3; "
                        "g=$(/usr/bin/id -g) || exit 3; [ \"$g\" = %d ] || exit 3; "
                        "exec /usr/bin/dd if=%s iflag=nofollow,nonblock,count_bytes count=%d bs=65536 status=none"
                        % (reader_uid, reader_gid, source, size + 1))
        reader = ("exec /usr/bin/setpriv --reuid=%d --regid=%d --clear-groups "
                  "--inh-caps=-all --ambient-caps=-all --bounding-set=-all --no-new-privs "
                  "/usr/bin/dash -eu -c %s < /dev/null > %s"
                  % (reader_uid, reader_gid, quote(checked_read), pipe))
        lines.extend(("reader_status=0",
            "/usr/bin/timeout --kill-after=1 2 /usr/bin/dash -eu -c " + quote(reader) + " || reader_status=$?",
            "writer_status=0", "wait \"$writer\" || writer_status=$?",
            "/usr/bin/rm -- " + quote(pipe) + " || die",
            "[ \"$reader_status\" = 0 ] && [ \"$writer_status\" = 0 ] || die",
            "file %s %d %s" % (quote(target), size, quote(expected))))
    lines.extend(("n=$(/usr/bin/find " + quote(protected_source_directory) + " -print) || die",
                  "s=$(printf '%s\\n' \"$n\" | /usr/bin/sort) || die",
                  "[ \"$s\" = '" + "\n".join(sorted(destination_nodes)) + "' ] || die"))
    # Recheck every control asset after all writers/low-privilege readers have
    # terminated and all temporary FIFOs have been removed. Return no Python exec.
    for relative, size, expected in payloads:
        lines.append("file %s %d %s" % (quote(protected_source_directory + "/" + relative),
                                       size, quote(expected)))
    lines.append("exit 0")
    script = ("\n".join(lines) + "\n").encode("ascii")
    _require(len(script) <= MAX_NATIVE_RECIPE_BYTES, "NATIVE_RECIPE_BOUND")
    return NativePreparationData(("/usr/bin/dash", "-eu"), script,
        hashlib.sha256(script).hexdigest(), (), "/", protected_source_directory,
        inventory.sha256, approval_sha256, "BEFORE_ORIGINAL_RUNSPEC_T0")


@dataclass(frozen=True)
class NativeBootstrapData:
    """DATA to review/pin externally; this object cannot authorize OS execution.

    The trusted VM executor supplies stdin_script and starts the FIRST native
    image with environment={}, from cwd='/', in the already approved OS image.
    /usr/bin/env cannot cleanse the loader of the process that invokes it.
    """
    bootstrap_argv: tuple[str, ...]
    stdin_script: bytes
    script_sha256: str
    environment: tuple[tuple[str, str], ...]
    cwd: str
    python_argv: tuple[str, ...]


def build_native_bootstrap(*, approval_raw: bytes, approval_sha256: str,
                          inventory_raw: bytes, inventory_sha256: str,
                          source_directory: str, protected_root: str,
                          auxiliary_output_directory: str):
    """Emit a bounded, literal native recipe; never launch it on this host.

    The first shell/utilities are trusted OS-profile prerequisites. Every file is
    copied into a new inode, without ACL/xattr preservation, with no-follow and
    a byte/time bound. All checked hashes precede the only Python exec. Approval
    and recipe pins must come from review OUTSIDE the editable ingress tree.
    """
    inventory = parse_inventory(inventory_raw, expected_sha256=inventory_sha256)
    approval = _parse_approval(approval_raw, approval_sha256)
    _validate_installation_pins(inventory, approval)
    entries = {f.path: f for f in inventory.files}
    _require(entries[APPROVAL_PATH].sha256 == approval_sha256 and
             entries[APPROVAL_PATH].size == len(approval_raw), "APPROVAL_NOT_INVENTORIED")
    for path in (source_directory, protected_root, auxiliary_output_directory):
        _absolute(path)
    def overlap(a, b):
        return a == b or a.startswith(b + "/") or b.startswith(a + "/")
    controls = [source_directory, protected_root, *approval["stdlib_paths"], approval["interpreter"]]
    _require(not any(overlap(auxiliary_output_directory, p) for p in controls)
             and not overlap(source_directory, protected_root)
             and not any(overlap(protected_root, p) for p in approval["stdlib_paths"]),
             "BOOTSTRAP_PATH_OVERLAP")
    # Paths are ASCII without shell punctuation; quoted as literals nonetheless.
    quote = lambda p: "'" + p + "'"
    lines = ["set -eu", "umask 077", "export LANG=C LC_ALL=C",
        "die() { exit 3; }",
        "node() {",
        "  [ ! -L \"$1\" ] || die",
        "  u=$(/usr/bin/stat -c %u -- \"$1\") || die",
        "  [ \"$u\" = 0 ] || die",
        "  m=$(/usr/bin/stat -c %a -- \"$1\") || die",
        "  [ $((0$m & 07022)) = 0 ] || die",
        "  a=$(/usr/bin/getfattr --absolute-names -d -m '^(system[.](posix_acl_access|posix_acl_default|nfs4_acl|richacl)|security[.]capability)$' -- \"$1\" 2>/dev/null) || die",
        "  [ -z \"$a\" ] || die",
        "}",
        "file() {",
        "  node \"$1\"",
        "  [ -f \"$1\" ] || die",
        "  l=$(/usr/bin/stat -c %h -- \"$1\") || die",
        "  [ \"$l\" = 1 ] || die",
        "  z=$(/usr/bin/stat -c %s -- \"$1\") || die",
        "  [ \"$z\" = \"$2\" ] || die",
        "  h=$(/usr/bin/sha256sum -- \"$1\") || die",
        "  [ \"${h%% *}\" = \"$3\" ] || die",
        "}"]
    lines.extend(("[ ! -e '" + VM_ABSENT_STARTUP_ZIP + "' ] || die",
                  "[ ! -L '" + VM_ABSENT_STARTUP_ZIP + "' ] || die",
                  "[ ! -L '/dev/null' ] || die", "[ -c '/dev/null' ] || die"))
    observed = set()
    def directory_checks(path):
        for parent in reversed((PurePosixPath(path), *PurePosixPath(path).parents)):
            text_path = str(parent)
            if text_path not in observed:
                lines.extend(("node " + quote(text_path), "[ -d " + quote(text_path) + " ] || die"))
                observed.add(text_path)
    # Source ancestors are protected before path-based native observations.
    directory_checks(source_directory)
    for target in (protected_root, auxiliary_output_directory):
        directory_checks(str(PurePosixPath(target).parent))
        lines.append("/usr/bin/mkdir -m 0700 -- " + quote(target) + " || die")
        directory_checks(target)
    startup = approval["startup_files"] + approval["identity"]["policy_files"]
    pins = {}
    for item in startup:
        _require(item["path"] not in pins or item == pins[item["path"]], "OS_PIN_CONFLICT")
        pins[item["path"]] = item
    for path, item in sorted(pins.items()):
        directory_checks(str(PurePosixPath(path).parent))
        lines.append("file %s %d %s" % (quote(path), item["size"], quote(item["sha256"])))
    # Exact startup directory closure includes every inventoried OS pyc and extension.
    for directory in approval["stdlib_paths"] + approval["identity"]["policy_directories"]:
        contained = {p for p in pins if p.startswith(directory + "/")}
        nodes = {directory, *contained}
        for path in contained:
            nodes.update(str(p) for p in PurePosixPath(path).parents
                         if str(p) == directory or str(p).startswith(directory + "/"))
        for path in sorted(nodes - contained):
            directory_checks(path)
        expected = "\n".join(sorted(nodes))
        lines.extend(("n=$(/usr/bin/find " + quote(directory) + " -print) || die",
                      "s=$(printf '%s\\n' \"$n\" | /usr/bin/sort) || die",
                      "[ \"$s\" = '" + expected + "' ] || die"))
    payloads = [(INVENTORY_NAME, len(inventory.raw), inventory.sha256)]
    payloads.extend((f.path, f.size, f.sha256) for f in inventory.files)
    source_nodes = {source_directory}
    made = set()
    lines.append("set -C")
    for relative, size, expected in payloads:
        source = source_directory + "/" + relative
        target = protected_root + "/" + relative
        parent = str(PurePosixPath(target).parent)
        # All mkdir operations are literal and fail if a directory already exists.
        for ancestor in reversed((PurePosixPath(parent), *PurePosixPath(parent).parents)):
            directory = str(ancestor)
            if directory.startswith(protected_root + "/") and directory not in made:
                lines.append("/usr/bin/mkdir -m 0700 -- " + quote(directory) + " || die")
                made.add(directory)
                directory_checks(directory)
        directory_checks(str(PurePosixPath(source).parent))
        source_nodes.add(source)
        source_nodes.update(str(p) for p in PurePosixPath(source).parents
                            if str(p).startswith(source_directory + "/"))
        lines.append("file %s %d %s" % (quote(source), size, quote(expected)))
        lines.append("/usr/bin/timeout 2 /usr/bin/dd if=%s iflag=nofollow,nonblock,count_bytes count=%d status=none > %s || die"
                     % (quote(source), size + 1, quote(target)))
        lines.append("file %s %d %s" % (quote(target), size, quote(expected)))
    lines.extend(("n=$(/usr/bin/find " + quote(source_directory) + " -print) || die",
                  "s=$(printf '%s\\n' \"$n\" | /usr/bin/sort) || die",
                  "[ \"$s\" = '" + "\n".join(sorted(source_nodes)) + "' ] || die"))
    full = lambda path: protected_root + "/" + path
    python_argv = (approval["interpreter"], "-I", "-S", "-B", full(ENTRY_PATH),
        "--root", protected_root, "--inventory-sha256", inventory.sha256,
        "--approval-sha256", approval_sha256,
        "--auxiliary-output-directory", auxiliary_output_directory)
    lines.extend(("cd " + quote(protected_root) + " || die",
                  "exec /usr/bin/env -i LANG=C.UTF-8 LC_ALL=C.UTF-8 " +
                  " ".join(quote(p) for p in python_argv) + " < /dev/null"))
    script = ("\n".join(lines) + "\n").encode("ascii")
    _require(len(script) <= MAX_NATIVE_RECIPE_BYTES, "NATIVE_RECIPE_BOUND")
    return NativeBootstrapData(("/usr/bin/dash", "-eu"), script,
        hashlib.sha256(script).hexdigest(), (), "/", python_argv)


@dataclass(frozen=True)
class ProtectedInputs:
    root: str
    inventory: Inventory
    blobs: Mapping[str, bytes]
    approval_raw: bytes
    approval_sha256: str


@dataclass(frozen=True)
class ProtectedPreRunInputs:
    root: str
    inventory: Inventory
    blobs: Mapping[str, bytes]
    approval_raw: bytes
    approval_sha256: str


def _read_single_protected_file(path: str, *, maximum: int, _os_bytecode=False, _retain=True):
    """First inventory read is anchored from /, before parsing or imports."""
    _require(sys.platform == "linux", "PLATFORM_NOT_SUPPORTED")
    (_os_path if _os_bytecode else _absolute)(path)
    retained = []
    directories = []
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    try:
        fd = os.open("/", flags)
        retained.append(fd)
        node, identity = _observe_fd(fd, "/", "directory", control_uid=0)
        directories.append((fd, identity))
        absolute = ""
        for part in path[1:].split("/")[:-1]:
            fd = os.open(part, flags, dir_fd=fd)
            retained.append(fd)
            absolute += "/" + part
            _, identity = _observe_fd(fd, absolute, "directory", control_uid=0)
            directories.append((fd, identity))
        child = os.open(path.rsplit("/", 1)[1], os.O_RDONLY | os.O_NOFOLLOW |
                        os.O_CLOEXEC | os.O_NONBLOCK, dir_fd=fd)
        retained.append(child)
        _, before = _observe_fd(child, path, "file", control_uid=0)
        size = os.fstat(child).st_size
        _require(0 <= size <= maximum, "DATA_BYTES")
        chunks, count, digest = [], 0, hashlib.sha256()
        while count <= size:
            chunk = os.read(child, min(65_536, size + 1 - count))
            if not chunk:
                break
            if _retain:
                chunks.append(chunk)
            digest.update(chunk)
            count += len(chunk)
        _require(count == size, "FILE_SIZE")
        _require(_stat_identity(os.fstat(child)) == before, "NODE_CHANGED_DURING_READ")
        for directory, identity in directories:
            _require(_stat_identity(os.fstat(directory)) == identity, "ANCESTOR_CHANGED")
        return b"".join(chunks) if _retain else (size, digest.hexdigest())
    except BootstrapError:
        raise
    except OSError as exc:
        raise BootstrapError("PROTECTED_TREE_UNAVAILABLE") from exc
    finally:
        for fd in reversed(retained):
            os.close(fd)


def read_protected_inputs(root: str, *, inventory_sha256: str, approval_sha256: str):
    """Return immutable bytes actually read; caller-made Inventory/Plan grants nothing."""
    _absolute(root)
    raw = _read_single_protected_file(root + "/" + INVENTORY_NAME, maximum=MAX_INVENTORY_BYTES)
    inventory = parse_inventory(raw, expected_sha256=inventory_sha256)
    blobs = _read_posix_tree(root, inventory, control_uid=0)
    _require(blobs[INVENTORY_NAME] == raw, "INVENTORY_CHANGED")
    _require(APPROVAL_PATH in blobs, "EXTERNAL_APPROVAL_MISSING")
    approval = _parse_approval(blobs[APPROVAL_PATH], approval_sha256)
    _validate_installation_pins(inventory, approval)
    return ProtectedInputs(root, inventory, blobs, blobs[APPROVAL_PATH], approval_sha256)


def read_protected_pre_run_inputs(root: str, *, inventory_sha256: str, approval_sha256: str):
    """Read a sealed intent and code tree with no RunSpec or invocation inventory."""
    _absolute(root)
    raw = _read_single_protected_file(root + "/" + INVENTORY_NAME, maximum=MAX_INVENTORY_BYTES)
    inventory = parse_inventory(raw, expected_sha256=inventory_sha256)
    blobs = _read_posix_tree(root, inventory, control_uid=0)
    _require(blobs[INVENTORY_NAME] == raw, "INVENTORY_CHANGED")
    _require(APPROVAL_PATH in blobs, "EXTERNAL_APPROVAL_MISSING")
    approval = _parse_approval(blobs[APPROVAL_PATH], approval_sha256)
    _validate_installation_pins(inventory, approval, pre_run=True)
    return ProtectedPreRunInputs(root, inventory, blobs, blobs[APPROVAL_PATH], approval_sha256)


def build_pre_run_entry_argv(*, protected_root: str, inventory_sha256: str,
                             approval_raw: bytes, approval_sha256: str,
                             auxiliary_output_directory: str):
    """Inert fixed argv for the first independently protected Python start.

    The trusted VM caller sets cwd=protected_root, EXPECTED_ENVIRONMENT and only
    /dev/null stdin plus stdout/stderr pipes. This function executes nothing and
    does not establish the required pre-Python OS/startup closure itself.
    """
    _absolute(protected_root)
    _absolute(auxiliary_output_directory)
    _sha(inventory_sha256)
    approval = _parse_approval(approval_raw, approval_sha256)
    _require(not (auxiliary_output_directory == protected_root or
                  auxiliary_output_directory.startswith(protected_root + "/") or
                  protected_root.startswith(auxiliary_output_directory + "/")),
             "AUXILIARY_CONTROL_OVERLAP")
    return (approval["interpreter"], "-I", "-S", "-B", protected_root + "/" + ENTRY_PATH,
        "--pre-run-root", protected_root, "--inventory-sha256", inventory_sha256,
        "--approval-sha256", approval_sha256,
        "--auxiliary-output-directory", auxiliary_output_directory)


def _validate_final_provenance(inventory, blobs, approval):
    """The final seal retains every pre-run byte; it grants no new code approval."""
    _require(inventory.name == CLOSED_INVOCATION_INVENTORY_NAME, "FINAL_INVENTORY_NAME")
    entries = {f.path: f for f in inventory.files}
    _require(INVENTORY_NAME in entries and RUN_INTENT_PATH in entries, "PRE_RUN_PROVENANCE_MISSING")
    pre = parse_inventory(blobs[INVENTORY_NAME], expected_sha256=entries[INVENTORY_NAME].sha256)
    _validate_installation_pins(pre, approval, pre_run=True)
    old = {f.path: f for f in pre.files}
    _require(set(entries) == set(old) | {INVENTORY_NAME, SPEC_PATH}, "FINAL_PROVENANCE_SET")
    _require(all(entries[path] == item for path, item in old.items()), "PRE_RUN_PROVENANCE_CHANGED")
    _require(entries[INVENTORY_NAME].role == "data" and entries[INVENTORY_NAME].size == len(pre.raw),
             "PRE_RUN_PROVENANCE_CHANGED")
    return pre


def _read_protected_final_inputs(root: str, *, inventory_sha256: str, approval_sha256: str):
    _absolute(root)
    raw = _read_single_protected_file(root + "/" + CLOSED_INVOCATION_INVENTORY_NAME,
                                      maximum=MAX_INVENTORY_BYTES)
    inventory = parse_inventory(raw, expected_sha256=inventory_sha256,
                                inventory_name=CLOSED_INVOCATION_INVENTORY_NAME)
    blobs = _read_posix_tree(root, inventory, control_uid=0)
    _require(blobs[CLOSED_INVOCATION_INVENTORY_NAME] == raw, "INVENTORY_CHANGED")
    _require(APPROVAL_PATH in blobs, "EXTERNAL_APPROVAL_MISSING")
    approval = _parse_approval(blobs[APPROVAL_PATH], approval_sha256)
    _validate_installation_pins(inventory, approval, final=True)
    _validate_final_provenance(inventory, blobs, approval)
    return ProtectedInputs(root, inventory, blobs, blobs[APPROVAL_PATH], approval_sha256)


def _refresh_inputs(inputs):
    _require(type(inputs) in (ProtectedInputs, ProtectedPreRunInputs), "PROTECTED_INPUTS_REQUIRED")
    if type(inputs) is ProtectedPreRunInputs:
        reader = read_protected_pre_run_inputs
    elif inputs.inventory.name == CLOSED_INVOCATION_INVENTORY_NAME:
        reader = _read_protected_final_inputs
    else:
        reader = read_protected_inputs
    fresh = reader(inputs.root, inventory_sha256=inputs.inventory.sha256,
                   approval_sha256=inputs.approval_sha256)
    _require(fresh == inputs, "PROTECTED_INPUTS_CHANGED")
    return fresh


def _observe_identity(approval):
    """Observe NSS identity plus approved OS policy pins; never create/change accounts.

    Policy-file semantics are approved with the fixed VM image outside this
    launcher. Matching hashes do not discover arbitrary administrative channels.
    NSS must be local files only for passwd/group; remote NSS is unsupported.
    """
    import pwd
    import grp
    wanted = approval["identity"]
    for item in wanted["policy_files"]:
        size, digest = _read_single_protected_file(item["path"], maximum=128 * 1024 * 1024,
                                                    _retain=False)
        _require(size == item["size"] and digest == item["sha256"],
                 "IDENTITY_POLICY_CHANGED")
        if item["path"] == "/etc/nsswitch.conf":
            raw = _read_single_protected_file(item["path"], maximum=MAX_INVENTORY_BYTES)
            _require(hashlib.sha256(raw).hexdigest() == digest, "IDENTITY_POLICY_CHANGED")
            text = raw.decode("ascii", "strict")
            for database in ("passwd", "group"):
                entries = [line.split("#", 1)[0].strip() for line in text.splitlines()
                           if line.split("#", 1)[0].strip().startswith(database + ":")]
                _require(len(entries) == 1 and entries[0].split(":", 1)[1].split() == ["files"],
                         "REMOTE_IDENTITY_SOURCE")
            initgroups = [line.split("#", 1)[0].strip() for line in text.splitlines()
                          if line.split("#", 1)[0].strip().startswith("initgroups:")]
            _require(not initgroups or (len(initgroups) == 1 and
                     initgroups[0].split(":", 1)[1].split() == ["files"]), "REMOTE_IDENTITY_SOURCE")
    try:
        account = pwd.getpwuid(wanted["uid"])
        named = pwd.getpwnam(wanted["name"])
        primary = grp.getgrgid(wanted["gid"])
        _uint(account.pw_uid)
        _uint(account.pw_gid)
        raw_groups = os.getgrouplist(account.pw_name, account.pw_gid)
        _require(type(raw_groups) is list and 0 < len(raw_groups) <= 128, "OBSERVED_GROUPS")
        for gid in raw_groups:
            _uint(gid)
        groups = tuple(sorted(set(raw_groups)))
        records = grp.getgrall()
        _uint(primary.gr_gid)
        for record in records:
            _uint(record.gr_gid)
    except (KeyError, OSError, AttributeError) as exc:
        raise BootstrapError("LOAD_ACCOUNT_UNAVAILABLE") from exc
    _require(account == named and account.pw_uid == wanted["uid"] and
             account.pw_gid == wanted["gid"] and account.pw_name == wanted["name"]
             and account.pw_shell == wanted["shell"] and account.pw_dir == wanted["home"]
             and primary.gr_gid == wanted["gid"], "LOAD_ACCOUNT_CHANGED")
    administrative = tuple(sorted(record.gr_name for record in records
        if record.gr_name in ADMINISTRATIVE_GROUP_NAMES and
        (record.gr_gid in groups or account.pw_name in record.gr_mem)))
    supplementary = tuple(gid for gid in groups if gid != account.pw_gid)
    forbidden = tuple(sorted({0, *(r.gr_gid for r in records
                                 if r.gr_name in ADMINISTRATIVE_GROUP_NAMES)}))
    identity = LoadIdentity(account.pw_uid, account.pw_gid, supplementary, administrative)
    check_load_identity(identity, control_uid=0, forbidden_gids=forbidden)
    _require(groups == (identity.gid,), "LOAD_GROUPS_CHANGED")
    return identity


@dataclass(frozen=True)
class ReviewedComponents:
    inputs: ProtectedInputs | ProtectedPreRunInputs
    wrapper: object
    contracts: object
    original_main: object
    clock_us: object


# Local construction guards, not cryptographic authority. No Python objects or
# callables cross the finite CLI/IPC boundary. A caller able to mutate this module
# as root is outside the trusted-OS/no-concurrent-administrator assumption.
_owned_components = {}
_owned_bindings = {}
_bound_main_created = set()
_owned_pre_run_bindings = {}
_producer_attempts = set()


def load_reviewed_components(inputs: ProtectedInputs | ProtectedPreRunInputs):
    """Only load fixed approved paths, after real protected reads and closed startup."""
    inputs = _refresh_inputs(inputs)
    approval = _parse_approval(inputs.approval_raw, inputs.approval_sha256)
    _require(sys.platform == "linux" and os.getuid() == os.geteuid() == 0,
             "CONTROL_AUTHORITY_REQUIRED")
    _require(sys.flags.isolated == 1 and sys.flags.no_site == 1 and
             sys.flags.dont_write_bytecode == 1, "PYTHON_STARTUP_FLAGS")
    _require(sys.executable == approval["interpreter"], "PYTHON_INTERPRETER_CHANGED")
    _require(dict(os.environ) == dict(EXPECTED_ENVIRONMENT), "AMBIENT_ENVIRONMENT")
    _require(os.getcwd() == inputs.root, "CONTROL_CWD_CHANGED")
    wrapper_hash = next(f.sha256 for f in inputs.inventory.files if f.path == WRAPPER_PATH)
    _require(wrapper_hash not in REJECTED_SUPERVISOR_SHA256,
             "WRAPPER_SINGLE_INVOCATION_DELTA_REVIEW_REQUIRED")
    _require(wrapper_hash == REVIEWED_WRAPPER_V9_SHA256, "REVIEWED_WRAPPER_PIN")
    _require(__file__ == inputs.root + "/" + ENTRY_PATH, "ENTRY_OUTSIDE_PROTECTED_TREE")
    _require(tuple(sys.path) == (VM_ABSENT_STARTUP_ZIP, *VM_STDLIB_PATHS),
             "INITIAL_STARTUP_PATH_CHANGED")
    # The native recipe checked this closure BEFORE Python began. Recheck protects
    # subsequent imports; this recheck alone is not a pre-startup bootstrap.
    for item in approval["startup_files"]:
        # OS bytecode paths need the separate safe OS grammar.
        _os_path(item["path"])
        size, digest = _read_single_protected_file_os(item["path"], maximum=128 * 1024 * 1024,
                                                     _retain=False)
        _require(size == item["size"] and digest == item["sha256"],
                 "STARTUP_CLOSURE_CHANGED")
    _require("_elogistix_reviewed_pilot" not in sys.modules and not any(
        name == "systemd_memory_runtime" or name.startswith("systemd_memory_runtime.")
        for name in sys.modules), "PRELOADED_RUNTIME_MODULE")
    sys.path[:] = [*approval["stdlib_paths"], inputs.root + "/" + PACKAGE_DIRECTORY]
    import importlib.util
    import importlib
    import importlib.machinery
    wrapper_spec = importlib.util.spec_from_file_location("_elogistix_reviewed_pilot",
                                                        inputs.root + "/" + WRAPPER_PATH)
    _require(wrapper_spec is not None and wrapper_spec.loader is not None, "WRAPPER_LOADER")
    wrapper = importlib.util.module_from_spec(wrapper_spec)
    sys.modules[wrapper_spec.name] = wrapper
    try:
        package_path = inputs.root + "/package/systemd_memory_runtime"
        init_relative = "package/systemd_memory_runtime/__init__.py"
        if init_relative in inputs.blobs:
            package_spec = importlib.util.spec_from_file_location("systemd_memory_runtime",
                inputs.root + "/" + init_relative, submodule_search_locations=[package_path])
        else:
            package_spec = importlib.machinery.ModuleSpec("systemd_memory_runtime", loader=None,
                                                        is_package=True)
            package_spec.submodule_search_locations = [package_path]
        _require(package_spec is not None, "CANONICAL_PACKAGE_LOADER")
        package = importlib.util.module_from_spec(package_spec)
        sys.modules["systemd_memory_runtime"] = package
        if package_spec.loader is not None:
            package_spec.loader.exec_module(package)
        _require(list(package.__path__) == [package_path], "CANONICAL_PACKAGE_PATH")
        central = importlib.import_module("systemd_memory_runtime.__main__")
        contracts = importlib.import_module("systemd_memory_runtime.contracts")
        original_main, clock_us = central.main, central.monotonic_us
        _require(getattr(original_main, "__module__", None) == "systemd_memory_runtime.__main__"
                 and getattr(getattr(original_main, "__code__", None), "co_filename", None)
                 == inputs.root + "/package/systemd_memory_runtime/__main__.py", "ORIGINAL_MAIN_ORIGIN")
        wrapper_spec.loader.exec_module(wrapper)
        for name, module in tuple(sys.modules.items()):
            if name == "_elogistix_reviewed_pilot" or name.startswith("systemd_memory_runtime.") or (
                    name == "systemd_memory_runtime" and init_relative in inputs.blobs):
                origin = getattr(module, "__file__", None)
                _require(type(origin) is str and origin.startswith(inputs.root + "/"),
                         "IMPORT_OUTSIDE_CONTROL_TREE")
                relative = origin[len(inputs.root) + 1:]
                _require(relative in inputs.blobs and relative.endswith(".py"), "UNINVENTORIED_IMPORT")
        _refresh_inputs(inputs)
        components = ReviewedComponents(inputs, wrapper, contracts, original_main, clock_us)
        _owned_components[id(components)] = components
        return components
    except BaseException:
        for name in tuple(sys.modules):
            if name == "_elogistix_reviewed_pilot" or name == "systemd_memory_runtime" or name.startswith("systemd_memory_runtime."):
                del sys.modules[name]
        raise


def _read_single_protected_file_os(path: str, *, maximum: int, _retain=True):
    # Same descriptor implementation, allowing ONLY pinned OS bytecode paths.
    _os_path(path)
    return _read_single_protected_file(path, maximum=maximum, _os_bytecode=True, _retain=_retain)


@dataclass(frozen=True)
class ScopeSpecBinding:
    components: ReviewedComponents
    spec: object
    identity: LoadIdentity
    scope_receipt: Mapping


def _validate_scope_sources(inputs, components):
    """Existing scope/source validators and real local policy/account observations."""
    _require(type(components) is ReviewedComponents and
             _owned_components.get(id(components)) is components, "UNBOUND_REVIEWED_COMPONENTS")
    _require(components.inputs == inputs,
             "COMPONENT_INPUTS_CHANGED")
    approval = _parse_approval(inputs.approval_raw, inputs.approval_sha256)
    W, C = components.wrapper, components.contracts
    manifest = W.parse_strict_json(inputs.blobs[SOURCE_MANIFEST_PATH])
    _require(type(manifest) is dict and set(manifest) == SOURCE_MANIFEST_KEYS and
             manifest["schema"] == SOURCE_SCHEMA and manifest["repository"] == REPOSITORY
             and manifest["source_commit"] == approval["source_commit"], "SOURCE_MANIFEST_SEMANTICS")
    _require(type(manifest["files"]) is list, "SOURCE_MANIFEST_FILES")
    source_files = {}
    for entry in manifest["files"]:
        _require(type(entry) is dict and set(entry) == SOURCE_ENTRY_KEYS, "SOURCE_ENTRY_KEYS")
        path = _relative(entry["path"])
        _require(path not in {APPROVAL_PATH, SPEC_PATH, RUN_INTENT_PATH, SCOPE_PATH,
                            SOURCE_MANIFEST_PATH, CONTEXT_PATH, ELF_PATH, INVENTORY_NAME,
                            CLOSED_INVOCATION_INVENTORY_NAME}, "SOURCE_DYNAMIC_REFERENCE")
        _require(path in inputs.blobs and path not in source_files and
                 type(entry["size"]) is int and len(inputs.blobs[path]) == entry["size"],
                 "SOURCE_FILE_SIZE_OR_SET")
        source_files[path] = inputs.blobs[path]
    _require({f["path"] for f in approval["python_files"]} <= set(source_files),
             "SOURCE_MANIFEST_MISSING_PYTHON")
    _require("sources/keeper.c" not in inputs.blobs or "sources/keeper.c" in source_files,
             "SOURCE_MANIFEST_MISSING_KEEPER")
    context = W.parse_strict_json(inputs.blobs[CONTEXT_PATH])
    parsed = W.extract_approved_scope(inputs.blobs[SCOPE_PATH])
    _require(parsed.values["authorization_ref"] == approval["authorization_ref"], "SCOPE_AUTHORIZATION_BINDING")
    constants = {"WORK_US": C.WORK_US, "CLEANUP_US": C.CLEANUP_US,
                 "MEMORY_MAX_BYTES": C.MEMORY_MAX_BYTES, "TASKS_MAX": C.TASKS_MAX}
    scope_receipt = W.validate_scope(parsed, context=context, expected_branch=approval["branch"],
        expected_source_commit=approval["source_commit"], yaml_bytes=inputs.blobs[YAML_PATH],
        manifest_bytes=inputs.blobs[SOURCE_MANIFEST_PATH], manifest_path=SOURCE_MANIFEST_PATH,
        source_files=source_files, manifest_keys=SOURCE_MANIFEST_KEYS,
        entry_keys=SOURCE_ENTRY_KEYS, shared_constants=constants)
    identity = _observe_identity(approval)
    return approval, parsed.values["scope_ref"], scope_receipt, identity


def bind_scope_spec_identity(inputs: ProtectedInputs, components: ReviewedComponents):
    """Existing validators, same protected bytes, real identity, unchanged deadlines."""
    inputs = _refresh_inputs(inputs)
    approval, scope_ref, scope_receipt, identity = _validate_scope_sources(inputs, components)
    W, C = components.wrapper, components.contracts
    raw_spec = inputs.blobs[SPEC_PATH]
    spec = C.RunSpec.from_mapping(W.parse_strict_json(raw_spec,
        max_bytes=C.MAX_PACKET_BYTES, max_depth=C.MAX_DEPTH))
    _require(spec.load_uid == identity.uid and spec.load_gid == identity.gid and
             spec.load_groups == tuple(sorted({identity.gid, *identity.supplementary_gids})),
             "SPEC_IDENTITY_MISMATCH")
    _require(spec.scope_ref == scope_ref == W.AUTHORIZATION_SCOPE_REF,
             "SPEC_SCOPE_MISMATCH")
    elf = inputs.blobs[ELF_PATH]
    _require(elf.startswith(b"\x7fELF") and hashlib.sha256(elf).hexdigest() ==
             spec.payload_expected_sha256, "SPEC_ELF_MISMATCH")
    now = components.clock_us()
    _require(type(now) is int and spec.t0_us <= now < spec.work_deadline_us,
             "ORIGINAL_WORK_DEADLINE")
    _refresh_inputs(inputs)
    binding = ScopeSpecBinding(components, spec, identity, MappingProxyType(dict(scope_receipt)))
    _owned_bindings[id(binding)] = binding
    return binding


@dataclass(frozen=True)
class PreRunBinding:
    components: ReviewedComponents
    intent_raw: bytes
    identity: LoadIdentity
    scope_ref: str
    scope_receipt: Mapping


def _validate_run_intent(raw, components, *, identity, scope_ref):
    W, C = components.wrapper, components.contracts
    intent = W.parse_strict_json(raw, max_bytes=C.MAX_PACKET_BYTES, max_depth=C.MAX_DEPTH)
    _require(type(intent) is dict and set(intent) == RUN_INTENT_KEYS and
             intent["schema"] == RUN_INTENT_SCHEMA, "PRE_RUN_INTENT_KEYS")
    _require(type(intent["run"]) is str and re.fullmatch("[0-9a-f]{32}", intent["run"])
             is not None, "PRE_RUN_INTENT_RUN")
    _require(type(intent["slots"]) is list and len(intent["slots"]) == 3, "PRE_RUN_INTENT_SLOTS")
    # Reuse the owner's slot semantics before the clock; never fabricate a t0=0 spec.
    slots = tuple(sorted((C.SlotSpec.from_mapping(item) for item in intent["slots"]),
                         key=lambda item: item.slot))
    _require(tuple(item.slot for item in slots) == (0, 1, 2) and
             len({item.unit_name for item in slots}) == 3, "PRE_RUN_INTENT_SLOTS")
    _require(type(intent["load_uid"]) is int and type(intent["load_gid"]) is int and
             intent["load_uid"] == identity.uid and intent["load_gid"] == identity.gid and
             type(intent["load_groups"]) is list and
             all(type(gid) is int for gid in intent["load_groups"]) and
             intent["load_groups"] == sorted({identity.gid, *identity.supplementary_gids}),
             "PRE_RUN_INTENT_IDENTITY")
    _require(intent["scope_ref"] == scope_ref == W.AUTHORIZATION_SCOPE_REF,
             "PRE_RUN_INTENT_SCOPE")
    _require(intent["cleanup_policy_id"] == C.CLEANUP_POLICY_ID, "PRE_RUN_INTENT_CLEANUP_POLICY")
    elf = components.inputs.blobs[ELF_PATH]
    _require(elf.startswith(b"\x7fELF") and hashlib.sha256(elf).hexdigest() ==
             intent["payload_expected_sha256"], "PRE_RUN_INTENT_ELF")
    return intent


def validate_pre_run_inputs(inputs: ProtectedPreRunInputs, components: ReviewedComponents):
    """Validate protected original data and observe real facts; no clock or writes."""
    _require(type(inputs) is ProtectedPreRunInputs, "PROTECTED_PRE_RUN_INPUTS_REQUIRED")
    inputs = _refresh_inputs(inputs)
    approval, scope_ref, receipt, identity = _validate_scope_sources(inputs, components)
    _validate_installation_pins(inputs.inventory, approval, pre_run=True)
    raw = inputs.blobs[RUN_INTENT_PATH]
    _validate_run_intent(raw, components, identity=identity, scope_ref=scope_ref)
    _refresh_inputs(inputs)
    binding = PreRunBinding(components, raw, identity, scope_ref, MappingProxyType(dict(receipt)))
    _owned_pre_run_bindings[id(binding)] = binding
    return binding


def _reserve_producer_outputs(inputs):
    """Reserve both new regular files before t0; never delete a failed reservation.

    No rename, existing-file overwrite, runtime or service. The retained empty or
    partial files make a restart fail the pre-run exact-tree check and O_EXCL.
    """
    _require(sys.platform == "linux" and os.getuid() == os.geteuid() == 0,
             "CONTROL_AUTHORITY_REQUIRED")
    _absolute(inputs.root)
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    output_flags = os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC
    retained, ancestors = [], []
    try:
        fd = os.open("/", directory_flags)
        retained.append(fd)
        _, observed = _observe_fd(fd, "/", "directory", control_uid=0)
        ancestors.append((fd, observed))
        absolute = ""
        for part in inputs.root[1:].split("/"):
            fd = os.open(part, directory_flags, dir_fd=fd)
            retained.append(fd)
            absolute += "/" + part
            _, observed = _observe_fd(fd, absolute, "directory", control_uid=0)
            ancestors.append((fd, observed))
        root_fd = fd
        data_fd = os.open("data", directory_flags, dir_fd=root_fd)
        retained.append(data_fd)
        _observe_fd(data_fd, inputs.root + "/data", "directory", control_uid=0)
        _require(stat.S_IMODE(os.fstat(root_fd).st_mode) == 0o700 and
                 stat.S_IMODE(os.fstat(data_fd).st_mode) == 0o700, "PRODUCER_ROOT_NOT_PRIVATE")
        for ancestor, observed in ancestors:
            _require(_stat_identity(os.fstat(ancestor)) == observed, "ANCESTOR_CHANGED")
        spec_fd = os.open("run-spec.json", output_flags, 0o600, dir_fd=data_fd)
        retained.append(spec_fd)
        inventory_fd = os.open(CLOSED_INVOCATION_INVENTORY_NAME, output_flags, 0o600, dir_fd=root_fd)
        retained.append(inventory_fd)
        for output, path in ((spec_fd, inputs.root + "/" + SPEC_PATH),
                             (inventory_fd, inputs.root + "/" + CLOSED_INVOCATION_INVENTORY_NAME)):
            _observe_fd(output, path, "file", control_uid=0)
            info = os.fstat(output)
            _require(info.st_size == 0 and stat.S_IMODE(info.st_mode) == 0o600,
                     "PRODUCER_RESERVATION_NOT_EMPTY_PRIVATE")
            os.fsync(output)
        os.fsync(data_fd)
        os.fsync(root_fd)
        result = (root_fd, data_fd, spec_fd, inventory_fd)
        # Close ancestors before returning writable FDs. If a close fails, the
        # finally block still attempts every retained descriptor, including outputs.
        for opened in tuple(reversed(retained)):
            if opened not in result:
                os.close(opened)
                retained.remove(opened)
        retained.clear()
        return result
    except BootstrapError:
        raise
    except OSError as exc:
        raise BootstrapError("PRODUCER_RESERVATION_UNAVAILABLE") from exc
    finally:
        close_error = None
        for opened in reversed(retained):
            try:
                os.close(opened)
            except OSError as exc:
                close_error = exc
        if close_error is not None:
            raise BootstrapError("PRODUCER_FD_CLOSE_FAILED") from close_error


def _write_reserved_control_file(fd, raw, path):
    """Write only our fresh reserved inode, then verify its exact stable bytes."""
    _require(type(raw) is bytes and 0 < len(raw) <= MAX_INVENTORY_BYTES, "PRODUCER_OUTPUT_BOUND")
    _observe_fd(fd, path, "file", control_uid=0)
    info = os.fstat(fd)
    _require(info.st_size == 0 and stat.S_IMODE(info.st_mode) == 0o600,
             "PRODUCER_RESERVATION_NOT_EMPTY_PRIVATE")
    remaining = memoryview(raw)
    while remaining:
        count = os.write(fd, remaining)
        _require(type(count) is int and 0 < count <= len(remaining), "PRODUCER_SHORT_WRITE")
        remaining = remaining[count:]
    os.fsync(fd)
    _, observed = _observe_fd(fd, path, "file", control_uid=0)
    _require(os.fstat(fd).st_size == len(raw), "PRODUCER_OUTPUT_SIZE")
    os.lseek(fd, 0, os.SEEK_SET)
    chunks, size = [], 0
    while size <= len(raw):
        chunk = os.read(fd, min(65_536, len(raw) + 1 - size))
        if not chunk:
            break
        chunks.append(chunk)
        size += len(chunk)
    _require(b"".join(chunks) == raw and size == len(raw), "PRODUCER_OUTPUT_CHANGED")
    _require(_stat_identity(os.fstat(fd)) == observed, "NODE_CHANGED_DURING_READ")


def _final_inventory_bytes(pre, *, spec_sha256, spec_size):
    entries = [*pre.files, FileEntry(INVENTORY_NAME, pre.sha256, len(pre.raw), "data"),
               FileEntry(SPEC_PATH, spec_sha256, spec_size, "spec")]
    value = {"schema": INVENTORY_SCHEMA, "files": [
        {"path": item.path, "sha256": item.sha256, "size": item.size, "role": item.role}
        for item in sorted(entries, key=lambda item: item.path)]}
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")


def produce_original_runspec(binding: PreRunBinding):
    """Seal the original canonical RunSpec with exactly one central-clock origin.

    The caller cannot supply a t0, a clock, a main replacement or OS probe facts.
    Every failure consumes this attempt. All writes, final reads, supervision,
    imports in main and preflight after t0 consume the original 50s/60s deadlines.
    """
    _require(type(binding) is PreRunBinding and
             _owned_pre_run_bindings.get(id(binding)) is binding, "UNBOUND_PRE_RUN")
    components = binding.components
    inputs, C = components.inputs, components.contracts
    _require(type(inputs) is ProtectedPreRunInputs, "PROTECTED_PRE_RUN_INPUTS_REQUIRED")
    key = (inputs.root, inputs.inventory.sha256, inputs.approval_sha256)
    _require(key not in _producer_attempts, "PRODUCER_ATTEMPT_CONSUMED")
    _producer_attempts.add(key)
    inputs = _refresh_inputs(inputs)
    approval, scope_ref, receipt, identity = _validate_scope_sources(inputs, components)
    _require(identity == binding.identity and scope_ref == binding.scope_ref and
             dict(receipt) == dict(binding.scope_receipt), "PRE_RUN_OBSERVATIONS_CHANGED")
    _require(inputs.blobs[RUN_INTENT_PATH] == binding.intent_raw, "RUN_INTENT_CHANGED")
    intent = _validate_run_intent(binding.intent_raw, components, identity=identity, scope_ref=scope_ref)
    # Reserve headroom before the clock, including retained pre-run provenance.
    headroom = _final_inventory_bytes(inputs.inventory, spec_sha256="0" * 64,
                                      spec_size=C.MAX_PACKET_BYTES)
    parse_inventory(headroom, expected_sha256=hashlib.sha256(headroom).hexdigest(),
                    inventory_name=CLOSED_INVOCATION_INVENTORY_NAME)
    _refresh_inputs(inputs)
    descriptors = _reserve_producer_outputs(inputs)
    try:
        t0 = components.clock_us()  # The sole origin; no retry and no derived fresh clock.
        _require(type(t0) is int and 0 <= t0 <= (1 << 64) - 1 - C.CLEANUP_US,
                 "ORIGINAL_CLOCK_VALUE")
        mapping = {key: value for key, value in intent.items() if key != "schema"}
        mapping.update(t0_us=str(t0), work_deadline_us=str(t0 + C.WORK_US),
                       cleanup_deadline_us=str(t0 + C.CLEANUP_US))
        spec = C.RunSpec.from_mapping(mapping)
        spec_raw = json.dumps(spec.to_mapping(), sort_keys=True, separators=(",", ":"),
                              ensure_ascii=True).encode("ascii")
        _require(0 < len(spec_raw) <= C.MAX_PACKET_BYTES, "ORIGINAL_SPEC_BYTES")
        final_raw = _final_inventory_bytes(inputs.inventory,
            spec_sha256=hashlib.sha256(spec_raw).hexdigest(), spec_size=len(spec_raw))
        final_hash = hashlib.sha256(final_raw).hexdigest()
        final_inventory = parse_inventory(final_raw, expected_sha256=final_hash,
            inventory_name=CLOSED_INVOCATION_INVENTORY_NAME)
        _validate_installation_pins(final_inventory, approval, final=True)
        _write_reserved_control_file(descriptors[2], spec_raw, inputs.root + "/" + SPEC_PATH)
        # The final inventory is published last, never an incomplete spec seal.
        _write_reserved_control_file(descriptors[3], final_raw,
                                     inputs.root + "/" + CLOSED_INVOCATION_INVENTORY_NAME)
    finally:
        # No writable control FD can escape into the wrapper or original main.
        close_error = None
        for fd in reversed(descriptors):
            try:
                os.close(fd)
            except OSError as exc:
                close_error = exc
        if close_error is not None:
            raise BootstrapError("PRODUCER_FD_CLOSE_FAILED") from close_error
    final_inputs = _read_protected_final_inputs(inputs.root, inventory_sha256=final_hash,
                                               approval_sha256=inputs.approval_sha256)
    _require(final_inputs.inventory == final_inventory and
             final_inputs.blobs[SPEC_PATH] == spec_raw and
             final_inputs.blobs[INVENTORY_NAME] == inputs.inventory.raw and
             all(final_inputs.blobs[path] == raw for path, raw in inputs.blobs.items()),
             "PRODUCER_FINAL_READ_CHANGED")
    # Keep the SAME loaded code, original main and central clock. Never reload it.
    final_components = ReviewedComponents(final_inputs, components.wrapper, C,
                                          components.original_main, components.clock_us)
    _owned_components[id(final_components)] = final_components
    final_binding = ScopeSpecBinding(final_components, spec, identity, binding.scope_receipt)
    _owned_bindings[id(final_binding)] = final_binding
    return final_binding


def make_bound_main(binding: ScopeSpecBinding):
    """Close over the original loaded main; no callable, module or argv arrives by IPC."""
    _require(type(binding) is ScopeSpecBinding, "SCOPE_SPEC_BINDING_REQUIRED")
    _require(_owned_bindings.get(id(binding)) is binding, "UNBOUND_SCOPE_SPEC")
    _require(id(binding) not in _bound_main_created, "BOUND_MAIN_ALREADY_CREATED")
    _bound_main_created.add(id(binding))
    inputs = binding.components.inputs
    _refresh_inputs(inputs)
    original_main = binding.components.original_main
    argv = ["run", "--spec", inputs.root + "/" + SPEC_PATH,
            "--source-elf", inputs.root + "/" + ELF_PATH]
    invoked = False
    def bound_main(*, evidence_sink, abort_requested):
        nonlocal invoked
        _require(not invoked, "BOUND_MAIN_ALREADY_INVOKED")
        invoked = True  # A failed call also consumes the sole invocation.
        _refresh_inputs(inputs)
        _require(callable(evidence_sink) and callable(abort_requested), "REVIEWED_HOOKS_REQUIRED")
        return original_main(argv, evidence_sink=evidence_sink, abort_requested=abort_requested)
    return bound_main


def _open_auxiliary_output(path, inputs):
    _absolute(path)
    _require(not (path == inputs.root or path.startswith(inputs.root + "/") or
                 inputs.root.startswith(path + "/")), "AUXILIARY_CONTROL_OVERLAP")
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    retained = []
    try:
        fd = os.open("/", flags)
        retained.append(fd)
        _observe_fd(fd, "/", "directory", control_uid=0)
        absolute = ""
        for part in path[1:].split("/"):
            fd = os.open(part, flags, dir_fd=fd)
            retained.append(fd)
            absolute += "/" + part
            _observe_fd(fd, absolute, "directory", control_uid=0)
        info = os.fstat(fd)
        _require(stat.S_IMODE(info.st_mode) == 0o700 and not os.listdir(fd),
                 "AUXILIARY_OUTPUT_NOT_FRESH_PRIVATE")
        # No writable output descriptor ever refers to a control asset.
        _require((info.st_dev, info.st_ino) != (os.stat(inputs.root, follow_symlinks=False).st_dev,
                                               os.stat(inputs.root, follow_symlinks=False).st_ino),
                 "AUXILIARY_CONTROL_ALIAS")
        result = retained.pop()
        return result
    except OSError as exc:
        raise BootstrapError("AUXILIARY_OUTPUT_UNAVAILABLE") from exc
    finally:
        for fd in reversed(retained):
            os.close(fd)


def _prepare_supervision_fds(output_fd):
    """Self-process FD hygiene only; no external PID/process/cgroup selection."""
    import signal
    import errno
    _require(signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL, "SIGCHLD_NOT_DEFAULT")
    tasks = os.listdir("/proc/self/task")
    _require(len(tasks) == 1 and all(re.fullmatch("[0-9]+", p) for p in tasks),
             "MULTITHREADED_ENTRY")
    null = os.lstat("/dev/null")
    incoming = os.fstat(0)
    _require(stat.S_ISCHR(null.st_mode) and not stat.S_ISLNK(null.st_mode) and
             stat.S_ISCHR(incoming.st_mode) and incoming.st_rdev == null.st_rdev,
             "STDIN_NOT_DEV_NULL")
    for fd in (1, 2):
        info = os.fstat(fd)
        _require(stat.S_ISFIFO(info.st_mode) or
                 (stat.S_ISCHR(info.st_mode) and info.st_rdev == null.st_rdev),
                 "UNSAFE_STDIO_CONTROL_ASSET")
    _require(type(output_fd) is int and output_fd > 2, "OUTPUT_FD_INVALID")
    probe = os.open("/proc/self/fd", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        allowed = {0, 1, 2, output_fd, probe}
        def live_fds():
            # listdir(fd) duplicates its directory FD on Linux. That temporary
            # descriptor can appear in /proc/self/fd but is closed on return.
            # Ignore only an explicitly observed EBADF, never an extra number.
            names = os.listdir(probe)
            _require(len(names) <= 256 and all(re.fullmatch("[0-9]+", p) for p in names),
                     "FD_INVENTORY_BOUND")
            live = set()
            for fd in sorted({int(p) for p in names}):
                try:
                    os.fstat(fd)
                except OSError as exc:
                    if exc.errno != errno.EBADF:
                        raise
                else:
                    live.add(fd)
            return live
        for fd in sorted(live_fds() - allowed):
            try:
                os.close(fd)
            except OSError as exc:
                if exc.errno != errno.EBADF:
                    raise
        _require(live_fds() == allowed, "UNEXPECTED_OPEN_FD")
    finally:
        os.close(probe)


SUPERVISION_KEYS = frozenset(("process_exit_code", "process_reaped", "capture_outcome",
    "supervision_status", "consumer", "remote_ack_sent", "abort_sent", "control_error",
    "evidence_eof", "evidence_frame_consumed", "evidence_wire_prefix", "runtime_ready",
    "certificate_verified", "runtime_child_pid", "exit_main", "child_return",
    "forced_stop_requested", "forced_stop_reaped", "forced_stop_error", "forced_stop_exit_code",
    "publication", "owned_child_reaped", "fd_cleanup_complete", "local_consumer_receipt_scope",
    "pending_owned_children", "pending_owned_child_pids"))
PUBLICATION_KEYS = frozenset(("status", "writer_pid", "writer_reaped", "writer_exit_code",
                             "error", "durability_guaranteed", "custody_authenticated"))
CONSUMER_KEYS = frozenset(("run", "cleanup_deadline_us", "invocation_attempted", "exit_code",
    "bound_main_called", "invocation_error", "stdout", "stderr", "capture_outcome",
    "composition_status", "evidence_delivery_attempted", "evidence_acknowledged", "evidence_bytes",
    "evidence_sha256", "abort_requested", "first_failure", "authorization_authenticated",
    "custody_authenticated", "certificate_verified_by_wrapper", "runtime_ready"))
CAPTURE_KEYS = frozenset(("retained_bytes", "observed_bytes", "discarded_observed_bytes", "eof",
    "overflow", "sha256_retained", "sha256_full", "status", "reason"))
_retained_supervision_returns = []
_pending_custody_handles = []


def _optional(value, kind):
    return value is None or type(value) is kind


def _validate_supervision_return(result, binding):
    """Validate owner's local data contract, never a native-certificate verifier."""
    _require(type(result) is dict and set(result) == SUPERVISION_KEYS, "SUPERVISOR_RESULT_KEYS")
    for key in ("process_reaped", "remote_ack_sent", "abort_sent", "evidence_eof",
                "evidence_frame_consumed", "forced_stop_requested", "forced_stop_reaped",
                "owned_child_reaped", "fd_cleanup_complete"):
        _require(type(result[key]) is bool, "SUPERVISOR_RESULT_TYPE")
    for key in ("process_exit_code", "forced_stop_exit_code", "exit_main"):
        _require(_optional(result[key], int), "SUPERVISOR_RESULT_TYPE")
    _require(result["exit_main"] is None or result["exit_main"] in (0, 2, 3), "EXIT_MAIN_DOMAIN")
    for key in ("control_error", "forced_stop_error"):
        _require(_optional(result[key], str), "SUPERVISOR_RESULT_TYPE")
    _require(type(result["runtime_child_pid"]) is int and result["runtime_child_pid"] > 0,
             "SUPERVISOR_RESULT_TYPE")
    _require(result["runtime_ready"] is False and result["certificate_verified"] is False,
             "SUPERVISOR_CERTIFICATION_FORBIDDEN")
    _require(result["capture_outcome"] in ("CAPTURE_COMPLETE", "RUNTIME_FAILED", "INCOMPLETE")
             and result["supervision_status"] in ("DATA_OBSERVED_ONLY", "INCOMPLETE"),
             "SUPERVISOR_STATUS_DOMAIN")
    _require(type(result["evidence_wire_prefix"]) is bytes and
             len(result["evidence_wire_prefix"]) <= 524300, "SUPERVISOR_EVIDENCE_BOUND")
    _require(result["local_consumer_receipt_scope"] == "PARENT_CAPTURE_COPY_NO_LOCAL_INVOCATION",
             "SUPERVISOR_PARENT_RECEIPT_SCOPE")
    child = result["child_return"]
    _require(child is None or (type(child) is dict and set(child) ==
             {"exit_main", "remote_acknowledged", "bridge_error"}), "CHILD_RETURN_KEYS")
    if child is not None:
        _require(type(child["exit_main"]) is int and child["exit_main"] in (0, 2, 3)
                 and type(child["remote_acknowledged"]) is bool and
                 _optional(child["bridge_error"], str) and child["exit_main"] == result["exit_main"],
                 "CHILD_RETURN_TYPE")
    publication = result["publication"]
    _require(type(publication) is dict and set(publication) == PUBLICATION_KEYS, "PUBLICATION_KEYS")
    _require(publication["status"] in ("FILES_WRITTEN", "INCOMPLETE") and
             _optional(publication["writer_pid"], int) and
             (publication["writer_pid"] is None or publication["writer_pid"] > 0)
             and type(publication["writer_reaped"]) is bool and
             _optional(publication["writer_exit_code"], int) and _optional(publication["error"], str)
             and publication["durability_guaranteed"] is False and
             publication["custody_authenticated"] is False, "PUBLICATION_TYPE")
    consumer = result["consumer"]
    _require(type(consumer) is dict and set(consumer) == CONSUMER_KEYS, "CONSUMER_RETURN_KEYS")
    _require(consumer["run"] == binding.spec.run and type(consumer["run"]) is str and
             type(consumer["cleanup_deadline_us"]) is int and
             consumer["cleanup_deadline_us"] == binding.spec.cleanup_deadline_us,
             "SUPERVISOR_RUN_DEADLINE_CHANGED")
    for key in ("invocation_attempted", "bound_main_called", "evidence_delivery_attempted",
                "evidence_acknowledged", "abort_requested"):
        _require(type(consumer[key]) is bool, "CONSUMER_RETURN_TYPE")
    for key in ("authorization_authenticated", "custody_authenticated",
                "certificate_verified_by_wrapper", "runtime_ready"):
        _require(consumer[key] is False, "CONSUMER_CERTIFICATION_FORBIDDEN")
    _require(_optional(consumer["exit_code"], int) and _optional(consumer["evidence_bytes"], int)
             and _optional(consumer["invocation_error"], str) and
             _optional(consumer["first_failure"], str) and _optional(consumer["evidence_sha256"], str)
             and type(consumer["capture_outcome"]) is str and type(consumer["composition_status"]) is str,
             "CONSUMER_RETURN_TYPE")
    for stream in ("stdout", "stderr"):
        capture = consumer[stream]
        _require(type(capture) is dict and set(capture) == CAPTURE_KEYS, "CAPTURE_RETURN_KEYS")
        for key in ("retained_bytes", "observed_bytes", "discarded_observed_bytes"):
            _require(type(capture[key]) is int and capture[key] >= 0, "CAPTURE_RETURN_TYPE")
        _require(type(capture["eof"]) is bool and type(capture["overflow"]) is bool and
                 type(capture["sha256_retained"]) is str and _optional(capture["sha256_full"], str)
                 and type(capture["status"]) is str and _optional(capture["reason"], str), "CAPTURE_RETURN_TYPE")
    pending = result["pending_owned_children"]
    _require(type(pending) is tuple and len(pending) <= 2 and
             type(result["pending_owned_child_pids"]) is list, "PENDING_CUSTODY_TYPE")
    _require(all(type(getattr(h, "pid", None)) is int and h.pid > 0 and
                 hasattr(h, "returncode") and _optional(h.returncode, int)
                 and callable(getattr(h, "poll", None)) and callable(getattr(h, "kill", None))
                 for h in pending), "PENDING_CUSTODY_HANDLE")
    _require(all(type(pid) is int and pid > 0 for pid in result["pending_owned_child_pids"]),
             "PENDING_CUSTODY_TYPE")
    _require(result["pending_owned_child_pids"] == [h.pid for h in pending] and
             len({h.pid for h in pending}) == len(pending), "PENDING_CUSTODY_IDENTITY")
    # Parent invocation fields deliberately do not enter the success decision:
    # a consumed attempt may be recorded locally without invoking the child main.
    if result["supervision_status"] == "DATA_OBSERVED_ONLY":
        _require(not pending and result["exit_main"] == 0 and result["process_exit_code"] == 0
             and result["process_reaped"] is True and result["owned_child_reaped"] is True
             and result["fd_cleanup_complete"] is True
             and result["capture_outcome"] == "CAPTURE_COMPLETE" and result["evidence_eof"] is True
             and result["evidence_frame_consumed"] is True and result["remote_ack_sent"] is True
             and result["abort_sent"] is False and result["control_error"] is None
             and child is not None and child["remote_acknowledged"] is True
             and child["bridge_error"] is None and consumer["abort_requested"] is False
             and consumer["evidence_acknowledged"] is True
             and publication["status"] == "FILES_WRITTEN" and publication["writer_reaped"] is True
             and publication["writer_exit_code"] == 0 and publication["error"] is None
             and all(consumer[s]["eof"] is True and consumer[s]["overflow"] is False and
                     consumer[s]["status"] == "COMPLETE" for s in ("stdout", "stderr")),
             "SUPERVISOR_SUCCESS_INCONSISTENT")
    return result


def run_supervised(binding: ScopeSpecBinding, *, auxiliary_output_directory: str):
    """Physical capture/abort belongs to the reviewed wrapper, never duplicated here.

    A missing owner API is a concrete incomplete dependency. Return code, wait/reap,
    pipe EOF and provisional evidence remain separate facts in the owner's receipt.
    """
    _require(type(binding) is ScopeSpecBinding, "SCOPE_SPEC_BINDING_REQUIRED")
    _require(_owned_bindings.get(id(binding)) is binding, "UNBOUND_SCOPE_SPEC")
    components = binding.components
    wrapper, C = components.wrapper, components.contracts
    supervisor = getattr(wrapper, "supervise_bound", None)
    _require(callable(supervisor), "REVIEWED_SUPERVISOR_API_MISSING")
    consumer = wrapper.V5InvocationConsumer(run=binding.spec.run,
        cleanup_deadline_us=binding.spec.cleanup_deadline_us, clock_us=components.clock_us,
        shared_constants={"WORK_US": C.WORK_US, "CLEANUP_US": C.CLEANUP_US,
                          "MEMORY_MAX_BYTES": C.MEMORY_MAX_BYTES, "TASKS_MAX": C.TASKS_MAX})
    bound_main = make_bound_main(binding)
    output_fd = _open_auxiliary_output(auxiliary_output_directory, components.inputs)
    try:
        _prepare_supervision_fds(output_fd)
        result = supervisor(consumer, bound_main, output_dir_fd=output_fd)
        # Keep the actual local handles even if subsequent contract checks fail.
        # No PID is reconstructed or selected from serialized diagnostics.
        if type(result) is dict:
            _retained_supervision_returns.append(result)
            pending = result.get("pending_owned_children", ())
            if type(pending) is tuple and len(pending) <= 2:
                for handle in pending:
                    if (type(getattr(handle, "pid", None)) is int and handle.pid > 0
                        and callable(getattr(handle, "poll", None)) and
                        callable(getattr(handle, "kill", None))):
                        _pending_custody_handles.append(handle)
        return _validate_supervision_return(result, binding)
    finally:
        os.close(output_fd)


def main(argv=None):
    """Actual assembly route. Asus fails platform check before privileged operations."""
    try:
        _require(sys.platform == "linux", "PLATFORM_NOT_SUPPORTED")
        values = list(sys.argv[1:] if argv is None else argv)
        tail = ("--inventory-sha256", "--approval-sha256", "--auxiliary-output-directory")
        _require(len(values) == 8 and values[0] in ("--root", "--pre-run-root") and
                 tuple(values[2::2]) == tail and
                 all(type(v) is str for v in values), "ENTRY_ARGUMENTS")
        root, inventory_hash, approval_hash, output = values[1::2]
        reader = read_protected_pre_run_inputs if values[0] == "--pre-run-root" else read_protected_inputs
        inputs = reader(root, inventory_sha256=inventory_hash, approval_sha256=approval_hash)
        components = load_reviewed_components(inputs)
        if values[0] == "--pre-run-root":
            binding = produce_original_runspec(validate_pre_run_inputs(inputs, components))
        else:
            binding = bind_scope_spec_identity(inputs, components)
        result = run_supervised(binding, auxiliary_output_directory=output)
        metadata = {k: v for k, v in result.items()
                    if k not in ("pending_owned_children", "evidence_wire_prefix")}
        metadata["evidence_wire_prefix_bytes"] = len(result["evidence_wire_prefix"])
        metadata["native_runtime_certified"] = False
        print(json.dumps(metadata, sort_keys=True))
        return 0 if result["supervision_status"] == "DATA_OBSERVED_ONLY" else 3
    except (BootstrapError, ValueError, OSError, ImportError) as exc:
        print(json.dumps({"status": "INCOMPLETE", "error": getattr(exc, "code", "ENTRY_FAILURE"),
                          "native_runtime_certified": False}, sort_keys=True))
        return 3


def _retain_until_reaped():
    """CLI remains the custodian if its own original child survived the cutoff.

    No fresh deadline, service, root PID scan, waitpid(-1), or certification. This
    best-effort late cleanup can wait beyond 60s under kernel I/O/suspension;
    the already returned result remains INCOMPLETE. VM lifetime is external.
    """
    import time
    pending = list(_pending_custody_handles)
    attempted, errors = set(), set()
    while pending:
        remaining = []
        for handle in pending:
            try:
                code = handle.poll()
                _require(_optional(code, int), "PENDING_CUSTODY_POLL_TYPE")
                if code is not None:
                    continue
                if id(handle) not in attempted:
                    attempted.add(id(handle))
                    handle.kill()  # The owner's handle cannot accept another PID.
            except (OSError, ValueError) as exc:
                if id(handle) not in errors:
                    errors.add(id(handle))
                    print(json.dumps({"status": "INCOMPLETE", "error": "LATE_CUSTODY_ERROR",
                                      "native_runtime_certified": False}, sort_keys=True))
            remaining.append(handle)
        pending = remaining
        if pending:
            time.sleep(0.05)


if __name__ == "__main__":
    status = main()
    _retain_until_reaped()
    raise SystemExit(status)
