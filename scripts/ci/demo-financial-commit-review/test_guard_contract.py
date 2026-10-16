"""Offline source/ordering contracts, not a PostgreSQL parser or COMMIT proof."""
from pathlib import Path
import hashlib
import re
import unittest


HERE = Path(__file__).resolve().parent
UPSTREAM = HERE.parent / "demo-financial-compile-recovery" / "upstream" / "flow"
RETRY = HERE.parent / "demo-financial-behavior-recovery" / "sql" / "replay-correction.sql"
SOURCE_PINS = {
    "issuer/11-atomic-entry.sql": "a2093b45e37c922f0505e496581381b4b5a3d105d3f0e583d694ef92e9c47cb3",
    "sql/06-simulation-guards.sql": "44f88ad264f1c2e0bd89577fe1dcdd24e3b11a017b78c4b26ad911147e7012a3",
    "issuer/15-rpc-boundary.sql": "9656003b716ea2c60ec90b7a4de9dc1b21743c46a0ef1199f2522f9831979799",
    "issuer/16-owner-registry.sql": "a74d69ed6d19356ba36fe27d7070a496e99c3ef5cec7a030c3b96b609a64463b",
}
FUNCTION_PINS = {
    ("issuer/11-atomic-entry.sql", "authorize_issuance_deferred"): ("invoker", "798520f64eb79590ed9976afff7927df7e9d5627e2a84bbdcf48caa1acf977e9"),
    ("issuer/11-atomic-entry.sql", "assert_issued"): ("invoker", "82ddbca747d705b5653b4aa53b85ae2d3a4169798b8555846dc965793aefc3a2"),
    ("sql/06-simulation-guards.sql", "authorize_deferred"): ("definer", "fe378f19b3b38ed1d50aa750db7cd7853a149f9789d3adf4b204018419bf4dc0"),
    ("issuer/15-rpc-boundary.sql", "prepare_execute_checkpoint"): ("definer", "e02038088845b98527738e9f9ee71947b66c1c08532336a9c8f4591036e6110f"),
    ("issuer/16-owner-registry.sql", "assert_rpc_transport"): ("invoker", "4e82223f3f1702d31b62ffdd7488f057fe1fb9d0ec1447fe5048eb0ecc4796d9"),
}
RETRY_SHA256 = "aa8b64875e58626645974de6cfe575a45af719ecbc20773bfe6b414269b607e2"


def read(path):
    # Only worktree CRLF expansion is normalized; body pins are Git LF bytes.
    return path.read_bytes().replace(b"\r\n", b"\n").decode("utf-8")


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def require(value, message):
    if not value:
        raise ValueError(message)


def function_parts(source, name):
    declaration = re.search(r"(?im)^\s*CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+demo_flow_writer\." + re.escape(name) + r"\s*\(", source)
    require(declaration is not None, "function declaration missing")
    opening = re.search(r"\bAS\s+(\$[A-Za-z_0-9]*\$)", source[declaration.end():], re.I)
    require(opening is not None, "function delimiter missing")
    start = declaration.end() + opening.end()
    end = source.find(opening.group(1), start)
    require(end >= 0, "function body unterminated")
    return source[declaration.start():start], source[start:end]


def sql_tokens(source):
    """Small lexer for source ordering; comments and literals cannot be commands."""
    result = []
    i, size = 0, len(source)
    while i < size:
        char = source[i]
        if char.isspace():
            i += 1
        elif source.startswith("--", i):
            end = source.find("\n", i + 2)
            i = size if end < 0 else end + 1
        elif source.startswith("/*", i):
            i += 2
            depth = 1
            while i < size and depth:
                if source.startswith("/*", i): depth += 1; i += 2
                elif source.startswith("*/", i): depth -= 1; i += 2
                else: i += 1
            require(depth == 0, "unterminated comment")
        elif char in "'\"":
            quote = char
            i += 1
            value = []
            while i < size:
                if source[i] == quote:
                    if i + 1 < size and source[i + 1] == quote:
                        value.append(quote); i += 2; continue
                    i += 1
                    break
                if source[i] == "\\" and quote == "'" and i + 1 < size:
                    value.extend(source[i:i + 2]); i += 2; continue
                value.append(source[i]); i += 1
            else:
                raise ValueError("unterminated quoted token")
            result.append(("literal" if quote == "'" else "identifier", "".join(value)))
        elif char == "$" and (match := re.match(r"\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$", source[i:])):
            delimiter = match.group()
            end = source.find(delimiter, i + len(delimiter))
            require(end >= 0, "unterminated dollar literal")
            result.append(("literal", source[i + len(delimiter):end]))
            i = end + len(delimiter)
        elif char == "\\":
            end = source.find("\n", i)
            end = size if end < 0 else end
            command = source[i + 1:end].strip().split(None, 1)[0].lower()
            result.append(("meta", command))
            i = end
        elif match := re.match(r"[A-Za-z_][A-Za-z_0-9$]*", source[i:]):
            result.append(("word", match.group().lower()))
            i += len(match.group())
        else:
            result.append(("symbol", char)); i += 1
    return result


def statements(tokens):
    result, current = [], []
    for kind, value in tokens:
        if (kind == "symbol" and value == ";") or (kind == "meta" and value in ("g", "gset")):
            if current: result.append(current); current = []
        elif kind != "meta":
            current.append((kind, value))
    if current: result.append(current)
    return result


def words(statement):
    return [value for kind, value in statement if kind == "word"]


def names(statement):
    return [value.lower() for kind, value in statement if kind in ("word", "identifier")]


def has_boundary_call(statement):
    names = [value.lower() if kind == "identifier" else value for kind, value in statement if kind in ("word", "identifier", "symbol")]
    return any(names[index:index + 4] == ["demo_flow_writer", ".", "prepare_execute_checkpoint", "("] for index in range(len(names)))


def commit_sql_contract(source):
    tokens = sql_tokens(source)
    require(all(value in ("set", "g", "gset", "echo") for kind, value in tokens if kind == "meta"),
            "no SQL includes or dynamic psql execution")
    parsed = statements(tokens)
    calls = [index for index, statement in enumerate(parsed) if has_boundary_call(statement)]
    require(len(calls) == 1, "exactly one real boundary call")
    boundary = calls[0]
    beginnings = [index for index, statement in enumerate(parsed) if words(statement)[:1] in (["begin"], ["start"])]
    commits = [index for index, statement in enumerate(parsed) if words(statement)[:1] == ["commit"]]
    require(len(beginnings) == len(commits) == 1 and beginnings[0] < boundary < commits[0],
            "real BEGIN, boundary and COMMIT in order")
    require(words(parsed[boundary])[:1] == ["select"], "direct real boundary SELECT")
    transaction = parsed[beginnings[0]:commits[0] + 1]
    selected = False
    for statement in parsed:
        terms = names(statement)
        require("flush_deferred" not in terms, "no early deferred drain")
        require(not (terms[:2] == ["set", "constraints"] and "immediate" in terms), "no early SET CONSTRAINTS IMMEDIATE")
    for statement in transaction:
        terms = names(statement)
        require(terms[:1] not in (["do"], ["call"], ["create"], ["execute"], ["prepare"]),
                "no opaque command wrapper inside the business transaction")
        require(terms[:2] not in (["reset", "role"], ["reset", "all"]), "selected role retained until COMMIT")
        require(terms[:3] != ["set", "session", "authorization"], "session identity unchanged")
        if terms[:3] == ["set", "local", "role"]:
            require(terms[3:] == ["service_role"], "only selected service role is allowed")
            selected = True
        elif terms[:2] == ["set", "role"] or terms[:3] == ["set", "session", "role"]:
            raise ValueError("session role mutation is not the bounded local contract")
        if has_boundary_call(statement):
            require(selected, "technical role selected before boundary")
        tokens = statement
        for index, token in enumerate(tokens[:-2]):
            if token == ("word", "set_config") and tokens[index + 1] == ("symbol", "("):
                require(tokens[index + 2] not in (("literal", "role"), ("literal", "session_authorization")), "no hidden identity mutation")
        require(terms[:1] != ["rollback"], "no rollback replaces the required COMMIT")


def descriptor_only_contract(source):
    parsed = statements(sql_tokens(source))
    require(len(parsed) == 1, "descriptor proposal has one statement only")
    expected = sql_tokens("ALTER FUNCTION demo_flow_writer.authorize_issuance_deferred() SECURITY DEFINER")
    require(parsed[0] == expected, "only execution identity descriptor changes")


class GuardContractTests(unittest.TestCase):
    def test_upstream_sources_and_retry_correction_are_unchanged(self):
        for rel, expected in SOURCE_PINS.items():
            with self.subTest(path=rel): self.assertEqual(sha(read(UPSTREAM / rel)), expected)
        self.assertEqual(sha(read(RETRY)), RETRY_SHA256)

    def test_original_function_security_modes_and_exact_prosrc(self):
        for (rel, name), (security, expected) in FUNCTION_PINS.items():
            header, body = function_parts(read(UPSTREAM / rel), name)
            with self.subTest(function=name):
                self.assertRegex(header, rf"(?i)SECURITY\s+{security}\b")
                self.assertRegex(header, r"(?i)SET\s+search_path\s*=\s*pg_catalog\b")
                self.assertEqual(sha(body), expected)

    def test_original_deferred_trigger_binding_and_real_issuance_call(self):
        source = read(UPSTREAM / "issuer/11-atomic-entry.sql")
        _, body = function_parts(source, "authorize_issuance_deferred")
        self.assertRegex(body, r"(?i)PERFORM\s+demo_flow_writer\.assert_issued\s*\(\s*NEW\.execution_run_id\s*\)")
        self.assertRegex(source, r"(?is)CREATE\s+CONSTRAINT\s+TRIGGER\s+execution_authorized_deferred\s+AFTER\s+INSERT\s+ON\s+demo_flow_writer\.execution_receipts\s+DEFERRABLE\s+INITIALLY\s+DEFERRED\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+demo_flow_writer\.authorize_issuance_deferred\s*\(\s*\)")

    def test_real_transport_requires_owner_login_role_claim_and_policy(self):
        _, body = function_parts(read(UPSTREAM / "issuer/16-owner-registry.sql"), "assert_rpc_transport")
        for condition in (
            "current_user::regrole::oid<>owner_id", "t.login_role_oid=session_user::regrole::oid AND login.rolcanlogin",
            "selected_role=technical.oid", "technical.rolname='service_role'", "t.disabled_at IS NULL",
            "clock_timestamp()<t.valid_until", "current_setting('request.jwt.claims',true)",
        ):
            self.assertIn(condition, body)

    def test_separate_proposal_changes_descriptor_only(self):
        descriptor_only_contract(read(HERE / "sql" / "deferred-owner-context.sql"))

    def test_descriptor_proposal_cannot_change_body_owner_acl_config_or_binding(self):
        proposal = "ALTER FUNCTION demo_flow_writer.authorize_issuance_deferred() SECURITY DEFINER;"
        for addition in (
            "ALTER FUNCTION demo_flow_writer.authorize_issuance_deferred() OWNER TO other_role;",
            "GRANT EXECUTE ON FUNCTION demo_flow_writer.authorize_issuance_deferred() TO service_role;",
            "ALTER FUNCTION demo_flow_writer.authorize_issuance_deferred() SET search_path=public;",
            "CREATE OR REPLACE FUNCTION demo_flow_writer.authorize_issuance_deferred() RETURNS trigger AS $$BEGIN RETURN NEW; END$$ LANGUAGE plpgsql;",
            "ALTER TABLE demo_flow_writer.execution_receipts DISABLE TRIGGER execution_authorized_deferred;",
        ):
            with self.subTest(addition=addition), self.assertRaises(ValueError): descriptor_only_contract(proposal + addition)

    def test_lexer_accepts_format_variation_and_psql_query_terminator(self):
        for source in (
            "BEGIN; SET LOCAL ROLE service_role; SELECT demo_flow_writer.prepare_execute_checkpoint('x',0); COMMIT;",
            "begin ; /* multiline /* nested */ comment */ set\nlocal role service_role;\nselect demo_flow_writer.prepare_execute_checkpoint(:'context_id',0) AS result \\gset\n\\echo COMMIT_PHASE\nCoMmIt;",
            "BEGIN; SET LOCAL ROLE service_role; SELECT 'RESET ROLE; flush_deferred(); SET CONSTRAINTS ALL IMMEDIATE;'; SELECT demo_flow_writer.prepare_execute_checkpoint('x',0); COMMIT;",
            'BEGIN; SET LOCAL ROLE "service_role"; SELECT "demo_flow_writer"."prepare_execute_checkpoint"(\'x\',0); COMMIT;',
        ):
            with self.subTest(source=source): commit_sql_contract(source)

    def test_missing_or_misordered_real_commit_is_rejected(self):
        good = "BEGIN; SET LOCAL ROLE service_role; SELECT demo_flow_writer.prepare_execute_checkpoint('x',0); COMMIT;"
        for mutant in (
            good.replace("COMMIT;", "ROLLBACK;"),
            good.replace("COMMIT;", "SELECT 'COMMIT';"),
            good.replace("BEGIN;", ""),
            good.replace("SET LOCAL ROLE service_role;", ""),
            good.replace("COMMIT;", "") + "-- COMMIT;",
        ):
            with self.subTest(mutant=mutant), self.assertRaises(ValueError): commit_sql_contract(mutant)

    def test_early_guard_drain_or_role_reset_mutants_are_rejected(self):
        prefix = "BEGIN; SET LOCAL ROLE service_role; SELECT demo_flow_writer.prepare_execute_checkpoint('x',0);"
        for bypass in (
            "SELECT demo_financial_lab.flush_deferred();", 'SELECT demo_financial_lab."flush_deferred"();', "SET CONSTRAINTS ALL IMMEDIATE;",
            "SET CONSTRAINTS execution_authorized_deferred IMMEDIATE;", "RESET ROLE;", "RESET ALL;",
            "SET LOCAL ROLE postgres;", "SELECT set_config('role','postgres',true);",
            "SET SESSION AUTHORIZATION postgres;", "DO $$BEGIN SET CONSTRAINTS ALL IMMEDIATE; END$$;",
            "\\ir hidden-flush.sql\n", "SELECT 'SET CONSTRAINTS ALL IMMEDIATE;' \\gexec\n",
        ):
            with self.subTest(bypass=bypass), self.assertRaises(ValueError): commit_sql_contract(prefix + bypass + "COMMIT;")

    def test_authentic_business_and_retry_sql_keep_real_commit_contract(self):
        for name in ("business.sql", "retry.sql"):
            with self.subTest(suite=name): commit_sql_contract(read(HERE / "sql" / name))


if __name__ == "__main__":
    unittest.main()
