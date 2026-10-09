#!/usr/bin/env python3
"""Prepare isolated catalog fixtures; never connect to PostgreSQL."""
import hashlib
import re
import sys
from pathlib import Path


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


def source(sql: str) -> str:
    matches = re.findall(
        r"CREATE(?: OR REPLACE)? FUNCTION public\.validar_cierre_embarque\(p_embarque_id uuid\)"
        r"[\s\S]*?AS \$\$([\s\S]*?)\$\$;",
        sql,
    )
    if len(matches) != 1:
        raise ValueError("Expected one complete shipment closure definition")
    return matches[0]


def source_assertion(expected: str) -> str:
    tag = "$audit54_runtime_expected_source$"
    if tag in expected:
        raise ValueError("Unexpected fixture delimiter in source")
    return f"""DO $runtime_assert$
BEGIN
  IF (SELECT p.prosrc FROM pg_proc p
      WHERE p.oid='public.validar_cierre_embarque(uuid)'::regprocedure)
      IS DISTINCT FROM {tag}{expected}{tag} THEN
    RAISE EXCEPTION 'AUD54_RUNTIME_ASSERT: unexpected source body';
  END IF;
  IF to_regclass('pg_temp.audit54_cxc_metadata') IS NOT NULL THEN
    RAISE EXCEPTION 'AUD54_RUNTIME_ASSERT: forward metadata leaked into caller session';
  END IF;
END
$runtime_assert$;
"""


def main() -> None:
    root, output = (Path(value).resolve() for value in sys.argv[1:])
    previous = read(root / "supabase/migrations/20261007001300_audit139_cierre_saldo_atribuido.sql")
    # This contract runs immediately after AUD54, before later forwards.
    # Never use the evolving current schema mirror as the historical oracle.
    mirror = read(root / "scripts/ci/fixtures/audit54-cierre-post-forward.sql")
    forward = read(root / "supabase/migrations/20261009005400_audit54_cierre_cxc_saldo_real.sql")
    old_source, new_source = source(previous), source(mirror)
    if hashlib.sha256(new_source.encode("utf-8")).hexdigest() != "17217b03c4a5d5241347d41f1edffe261ef7b905ddd7b0dcb26078a9f1ccaf77":
        raise ValueError("AUD54 historical post-forward fixture changed")
    output.mkdir(parents=True, exist_ok=True)

    # Generated files alter catalog fixtures or a disposable test copy only.
    # The real forward and its functional closure body are never edited.
    (output / "assert-before.sql").write_text(source_assertion(old_source), encoding="utf-8")
    (output / "assert-after.sql").write_text(source_assertion(new_source), encoding="utf-8")
    drift = old_source.replace("BEGIN\n", "BEGIN\n  -- AUD54 catalog body drift fixture.\n", 1)
    if drift == old_source:
        raise ValueError("Missing original body anchor")
    (output / "body-drift.sql").write_text(previous.replace(old_source, drift, 1), encoding="utf-8")
    signature = "(p_embarque_id uuid)"
    if previous.count(signature) != 1:
        raise ValueError("Expected exactly one declaration signature")
    (output / "default-drift.sql").write_text(
        previous.replace(signature, "(p_embarque_id uuid DEFAULT NULL)", 1), encoding="utf-8"
    )

    marker = "DO $audit54_metadata$"
    if forward.count(marker) != 1:
        raise ValueError("Expected one late postcondition anchor")
    declaration = mirror[mirror.index("CREATE OR REPLACE FUNCTION public.validar_cierre_embarque") :]
    body_drift = new_source.replace("BEGIN\n", "BEGIN\n  -- AUD54 late body fault injection.\n", 1)
    faults = {
        "late-cost": "ALTER FUNCTION public.validar_cierre_embarque(uuid) COST 101;\n",
        "late-acl": "GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO anon;\n",
        "late-body": declaration.replace(new_source, body_drift, 1),
        "late-inheritance": """CREATE TEMP TABLE audit54_runtime_inheritance_snapshot ON COMMIT DROP AS
  SELECT proacl::text AS acl FROM pg_proc
  WHERE oid='public.validar_cierre_embarque(uuid)'::regprocedure;
GRANT authenticated TO anon;
DO $runtime_inherited$
BEGIN
  IF NOT has_function_privilege('anon','public.validar_cierre_embarque(uuid)','EXECUTE')
     OR (SELECT proacl::text FROM pg_proc
         WHERE oid='public.validar_cierre_embarque(uuid)'::regprocedure)
         IS DISTINCT FROM (SELECT acl FROM audit54_runtime_inheritance_snapshot) THEN
    RAISE EXCEPTION 'AUD54_RUNTIME_ASSERT: inherited late privilege must change no direct ACL';
  END IF;
END
$runtime_inherited$;
""",
    }
    for name, statement in faults.items():
        (output / f"{name}.sql").write_text(forward.replace(marker, statement + "\n" + marker, 1), encoding="utf-8")


if __name__ == "__main__":
    main()

