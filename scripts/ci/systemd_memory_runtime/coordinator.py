"""Coordinator for the closed protocol; only the watchdog can mutate units."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import socket
import sys
import time

from .contracts import (ContractError, Envelope, RunSpec, decode_packet,
                        digest_record, encode_packet, parse_u64, validate_memory_sample)


class ChannelTimeout(TimeoutError):
    pass


@dataclass(frozen=True)
class RunResult:
    status: str
    mode: str
    samples: tuple[dict[str, Any], ...]
    slots: tuple[dict[str, Any], ...]
    missing_evidence: tuple[str, ...]
    faults: tuple[str, ...]
    claimed_status: str | None
    certificate_verified: bool

    def to_mapping(self) -> dict[str, Any]:
        return {"status": self.status, "mode": self.mode, "samples": list(self.samples),
                "slots": list(self.slots), "missing_evidence": list(self.missing_evidence),
                "faults": list(self.faults), "claimed_status": self.claimed_status,
                "certificate_verified": self.certificate_verified,
                "memory_reclamation": "NOT_ESTABLISHED"}


class PrivateSocketChannel:
    """Own-fork inherited channel, bound to a retained watchdog process pin.

    Socketpair SO_PEERCRED reflects its creator, so it is not used to pretend
    the post-fork child is a fresh peer. Bootstrap custody plus the original
    retained process pin authenticate this channel.
    """

    test_only = False

    def __init__(self, sock: socket.socket, watchdog_pin: Any, *, clock_us=None, bootstrap=None):
        if sys.platform != "linux":
            raise RuntimeError("Operational channel requires Linux")
        if sock.family != socket.AF_UNIX or (sock.type & 0xF) != socket.SOCK_SEQPACKET:
            raise ValueError("Private SOCK_SEQPACKET channel required")
        if not isinstance(bootstrap, _ForkCustody) or not bootstrap.matches(sock, watchdog_pin):
            raise ValueError("Own-fork bootstrap custody required")
        self.sock = sock
        self.pin = watchdog_pin
        self.bootstrap = bootstrap
        self.clock = clock_us or (lambda: time.monotonic_ns() // 1000)
        self.watchdog_generation = watchdog_pin.generation

    def authenticate(self) -> bool:
        return self.bootstrap.matches(self.sock, self.pin) is True

    def send(self, packet: bytes, deadline_us: int) -> None:
        if not self.authenticate():
            raise ConnectionError("Watchdog generation unavailable")
        remaining = deadline_us - self.clock()
        if remaining <= 0:
            raise ChannelTimeout("Original deadline expired")
        self.sock.settimeout(min(remaining, 1_000_000) / 1_000_000)
        try:
            if self.sock.send(packet) != len(packet):
                raise ConnectionError("Partial packet")
        except socket.timeout as exc:
            raise ChannelTimeout("Packet delivery budget expired") from exc

    def receive(self, deadline_us: int) -> bytes | None:
        remaining = deadline_us - self.clock()
        if remaining <= 0:
            raise ChannelTimeout("Original deadline expired")
        self.sock.settimeout(min(remaining, 1_000_000) / 1_000_000)
        try:
            packet, ancillary, flags, _peer = self.sock.recvmsg(16_385, 256)
        except socket.timeout as exc:
            raise ChannelTimeout("No packet before operation budget") from exc
        if ancillary or flags & (socket.MSG_TRUNC | socket.MSG_CTRUNC):
            # Close any received rights before rejecting the forbidden ancillary data.
            import array
            import os
            for level, kind, data in ancillary:
                if level == socket.SOL_SOCKET and kind == socket.SCM_RIGHTS:
                    rights = array.array("i")
                    rights.frombytes(data[:len(data) - len(data) % rights.itemsize])
                    for fd in rights:
                        os.close(fd)
            raise ContractError("PROTOCOL", "Truncated or ancillary packet")
        return packet or None


class _ForkCustody:
    """Local capability created immediately after this process's own fork."""
    def __init__(self, sock, pin, *, parent_pid, child_pid):
        import os
        import struct
        if sys.platform != "linux" or parent_pid != os.getpid() or child_pid != pin.generation["pid"]:
            raise ValueError("Original fork custody mismatch")
        from .sd_bus_transport import bounded_read
        raw = bounded_read("/proc/%d/stat" % child_pid, 4096)
        tail = raw[raw.rfind(")") + 2:].split()
        if len(tail) < 20 or int(tail[1]) != parent_pid or tail[19] != pin.generation["start_ticks"]:
            raise ValueError("Original own-child generation required")
        creator, uid, _gid = struct.unpack("3i", sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        if creator != parent_pid or uid != os.geteuid():
            raise ValueError("Inherited creator identity mismatch")
        st = os.fstat(sock.fileno())
        self.socket_identity = (st.st_dev, st.st_ino)
        self.sock, self.pin, self.parent_pid, self.child_pid = sock, pin, parent_pid, child_pid

    def matches(self, sock, pin):
        import os
        try:
            st = os.fstat(sock.fileno())
            return self.sock is sock and self.pin is pin and self.parent_pid == os.getpid() and (
                (st.st_dev, st.st_ino) == self.socket_identity and self.child_pid == pin.generation["pid"] and
                pin.same_generation_alive() is True)
        except OSError:
            return False


class Coordinator:
    def __init__(self, run_spec: RunSpec | dict[str, Any], channel: Any, *, clock_us=None,
                 final_verifier: Any = None, abort_requested: Any = None):
        self.spec = RunSpec.from_mapping(run_spec.to_mapping() if isinstance(run_spec, RunSpec) else run_spec)
        self.channel = channel
        self.clock = clock_us or (lambda: time.monotonic_ns() // 1000)
        self.final_verifier = final_verifier
        if abort_requested is not None and not callable(abort_requested):
            raise ValueError("Callable abort guard required")
        self.abort_requested = abort_requested
        self.abort_consumed = False
        self.seq = 0
        self.last_incoming = 0
        self.last_observed: int | None = None
        self.last_now: int | None = None
        self.cleanup = False
        self.invalid = False
        self.faults: list[str] = []
        self.missing: set[str] = set()
        self.samples: dict[int, dict[str, Any]] = {}
        self.bindings: dict[int, dict[str, Any]] = {}
        self.transcript: list[dict[str, Any]] = []
        self.started: set[int] = set()

    def _now(self) -> int:
        now = self.clock()
        if type(now) is not int or now < self.spec.t0_us or (self.last_now is not None and now < self.last_now):
            self.invalid = True
            raise ContractError("PROTOCOL", "Clock moved backwards or has invalid type")
        self.last_now = now
        return now

    def _send(self, event: str, body: dict[str, Any], slot=None) -> int:
        now = self._now()
        deadline = self.spec.cleanup_deadline_us if self.cleanup else self.spec.work_deadline_us
        if now >= deadline:
            raise ChannelTimeout("Original phase deadline expired")
        if event == "RUN_SLOT" and (self.cleanup or now >= self.spec.work_deadline_us):
            raise ContractError("PROTOCOL", "No new work after cleanup")
        self.seq += 1
        envelope = Envelope.from_mapping({"v": 3, "run": self.spec.run, "sender": "COORDINATOR",
            "seq": self.seq, "slot": slot, "event": event, "request": None,
            "mono_us": str(now), "body": body})
        self.channel.send(encode_packet(envelope), min(deadline, now + 1_000_000))
        return self.seq

    def _begin_cleanup(self, reason: str) -> None:
        if self.cleanup:
            return
        self.cleanup = True  # Consume transition before uncertain delivery.
        try:
            self._send("BEGIN_CLEANUP", {"reason": reason})
        except (ConnectionError, ChannelTimeout, OSError, ContractError):
            self.missing.add("STOP_SETTLEMENT")

    def _check_abort(self) -> None:
        """A caller may only remove work authority; unknown removes it too.

        The synchronous trusted guard is bracketed by the original deadline;
        it cannot replace arming, grant scope or renew a budget.
        """
        if self.abort_requested is None or self.abort_consumed:
            return
        before = self._now()
        if not self.cleanup and before >= self.spec.work_deadline_us:
            self._begin_cleanup("DEADLINE")
        if before >= self.spec.cleanup_deadline_us:
            self.missing.add("DEADLINE")
            self._begin_cleanup("DEADLINE")
            return
        try:
            requested = self.abort_requested()
        except Exception:
            requested = None
        after = self._now()
        if not self.cleanup and after >= self.spec.work_deadline_us:
            self._begin_cleanup("DEADLINE")
        if after >= self.spec.cleanup_deadline_us:
            self.missing.add("DEADLINE")
            requested = None
        if type(requested) is not bool or requested:
            self.abort_consumed = True
            self.faults.append("AUTHORITY")
            self._begin_cleanup("FAULT")

    def _receive(self) -> Envelope | None:
        now = self._now()
        if not self.cleanup and now >= self.spec.work_deadline_us:
            self._begin_cleanup("DEADLINE")
        if now >= self.spec.cleanup_deadline_us:
            self.missing.add("DEADLINE")
            return None
        deadline = self.spec.cleanup_deadline_us if self.cleanup else self.spec.work_deadline_us
        packet = self.channel.receive(min(deadline, now + 1_000_000))
        if packet is None:
            self.faults.append("PEER_CLOSED")
            self._begin_cleanup("FAULT")
            return None
        message = decode_packet(packet)
        if message.run != self.spec.run or message.sender != "WATCHDOG" or message.seq != self.last_incoming + 1:
            self.invalid = True
            raise ContractError("PROTOCOL", "Wrong run, sender, replay or sequence gap")
        self.last_incoming = message.seq
        observed = parse_u64(message.to_mapping()["mono_us"])
        after = self._now()
        if observed < self.spec.t0_us or observed > after or (
                self.last_observed is not None and observed < self.last_observed):
            self.invalid = True
            raise ContractError("PROTOCOL", "Peer clock moved backwards or outside observation bracket")
        if after >= self.spec.cleanup_deadline_us:
            self.missing.add("DEADLINE")
            raise ChannelTimeout("Late or impossible observation")
        self.last_observed = observed
        self.transcript.append(message.to_mapping())
        body = message.to_mapping()["body"]
        if message.event == "FAULT":
            self.faults.append(body["code"])
            self.missing.update(body["missing_evidence"])
            if body["code"] in {"PROTOCOL", "IDENTITY_CHANGED", "AUTHENTICATION"}:
                self.invalid = True
            self._begin_cleanup("FAULT")
        elif message.event == "UNIT_BOUND":
            binding = body["unit_binding"]
            if message.slot is None or binding["slot"] != message.slot or (
                    binding["name"] != self.spec.slots[message.slot].unit_name):
                self.invalid = True
                raise ContractError("PROTOCOL", "Unit binding slot mismatch")
            previous = self.bindings.get(message.slot)
            if previous is not None and previous != binding:
                self.invalid = True
                raise ContractError("IDENTITY_CHANGED", "Original unit binding changed")
            self.bindings[message.slot] = binding
        elif message.event == "MEMORY_SAMPLE":
            sample = validate_memory_sample(body["sample"])
            if message.slot is None or message.slot in self.samples:
                self.invalid = True
                raise ContractError("PROTOCOL", "Duplicate or unbound sample")
            binding = self.bindings.get(message.slot)
            if binding is None or sample["unit_binding_ref"] != digest_record(binding):
                self.invalid = True
                raise ContractError("IDENTITY_CHANGED", "Sample is not bound to original unit")
            if parse_u64(sample["after_us"]) >= self.spec.work_deadline_us:
                self.missing.add("DEADLINE")
                self._begin_cleanup("DEADLINE")
            else:
                self.samples[message.slot] = sample
        return message

    def _result(self, body=None) -> RunResult:
        body = body or {}
        claimed = body.get("status")
        slots = body.get("slots", [{"slot": slot.slot, "leaf_status": "UNKNOWN"} for slot in self.spec.slots])
        self.missing.update(body.get("missing_evidence", []))
        if len(self.samples) != 3:
            self.missing.add("MEMORY_SAMPLE")
        verified = False
        if claimed == "COMPLETE" and not self.invalid and not self.missing and not self.faults:
            # Authenticity lives in the retained producer/store, not in SHA-shaped strings.
            if self.final_verifier is not None:
                try:
                    if self._now() >= self.spec.cleanup_deadline_us:
                        self.missing.add("DEADLINE")
                    else:
                        verified = self.final_verifier.verify(self.spec, body, tuple(self.transcript)) is True
                        self._check_abort()
                        if self.abort_consumed:
                            verified = False
                        if self._now() >= self.spec.cleanup_deadline_us:
                            self.missing.add("DEADLINE")
                            verified = False
                except (OSError, ValueError, RuntimeError, ContractError, KeyError, TypeError, AttributeError):
                    verified = False
            if not verified:
                self.missing.update(("KEEPER_REAP", "REAP_LEDGER", "FINAL_UNIT_OBSERVATION"))
        if self.invalid or claimed == "INVALID":
            status = "INVALID"
        elif claimed == "COMPLETE" and verified and not self.missing and not self.faults and all(
                slot.get("leaf_status") == "CLOSED_REMOVED" for slot in slots):
            status = "COMPLETE"
        else:
            status = "INCOMPLETE"
        return RunResult(status, "linux-runtime" if type(self.channel) is PrivateSocketChannel else "hermetic",
                         tuple(self.samples[index] for index in sorted(self.samples)), tuple(slots),
                         tuple(sorted(self.missing)), tuple(self.faults), claimed, verified)

    def run(self) -> RunResult:
        try:
            if self.channel.authenticate() is not True:
                self.faults.append("AUTHENTICATION")
                self.invalid = True
                return self._result()
            arm_request = self._send("ARM", {"run_spec": self.spec.to_mapping(),
                               "payload_expected_sha256": self.spec.payload_expected_sha256})
            armed = False
            next_slot = 0
            awaiting_dispatch = False
            dispatch_request = None
            while True:
                try:
                    if armed:
                        self._check_abort()
                    message = self._receive()
                except ChannelTimeout:
                    if self._now() >= self.spec.cleanup_deadline_us:
                        self.missing.add("DEADLINE")
                        break
                    if self._now() >= self.spec.work_deadline_us:
                        self._begin_cleanup("DEADLINE")
                    continue
                if message is None:
                    break
                body = message.to_mapping()["body"]
                if message.event == "FINAL":
                    self._check_abort()
                    return self._result(body)
                if message.event == "ARMED":
                    if armed or self.cleanup or message.request != arm_request:
                        raise ContractError("PROTOCOL", "Unexpected arming acknowledgement")
                    generation = getattr(self.channel, "watchdog_generation", None)
                    if generation is None or body["watchdog_generation"] != generation:
                        raise ContractError("AUTHENTICATION", "Watchdog bootstrap generation mismatch")
                    if body["payload_binding"]["sha256"] != self.spec.payload_expected_sha256:
                        raise ContractError("IDENTITY_CHANGED", "Armed payload differs from expected image")
                    if parse_u64(body["manager_binding"]["authority_lease_until_us"]) <= self._now():
                        raise ContractError("AUTHORITY", "Expired arming authority")
                    if body["work_deadline_us"] != str(self.spec.work_deadline_us) or (
                            body["cleanup_deadline_us"] != str(self.spec.cleanup_deadline_us)):
                        raise ContractError("PROTOCOL", "Arming reset original deadlines")
                    armed = True
                elif message.event == "START_DISPATCHED":
                    if not armed or not awaiting_dispatch or message.slot != next_slot or message.request != dispatch_request:
                        raise ContractError("PROTOCOL", "Unexpected dispatch acknowledgement")
                    self.started.add(next_slot)
                    next_slot += 1
                    awaiting_dispatch = False
                self._check_abort()
                if armed and not self.cleanup and not awaiting_dispatch and next_slot < 3:
                    slot = self.spec.slots[next_slot]
                    dispatch_request = self._send("RUN_SLOT", {"slot_spec_sha256": digest_record(slot)}, slot=slot.slot)
                    awaiting_dispatch = True
                if not self.cleanup and len(self.samples) == 3:
                    self._begin_cleanup("NORMAL")
        except ContractError as exc:
            self.faults.append(getattr(exc, "code", "PROTOCOL"))
            self.invalid = True
            self._begin_cleanup("FAULT")
        except (ConnectionError, OSError, ChannelTimeout) as exc:
            self.faults.append("TRANSPORT_UNKNOWN")
            self._begin_cleanup("FAULT")
        return self._result()


def run(run_spec, watchdog_control_socket, *, clock_us=None, final_verifier=None, abort_requested=None) -> RunResult:
    return Coordinator(run_spec, watchdog_control_socket, clock_us=clock_us,
                       final_verifier=final_verifier, abort_requested=abort_requested).run()
