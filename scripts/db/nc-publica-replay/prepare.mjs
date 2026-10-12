#!/usr/bin/env node
// Dependency-free extraction of literal repository DDL. No SQL emulation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, '../../..');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!['--source-root', '--candidate-root', '--out'].includes(key) || !process.argv[i + 1] || args.has(key)) {
    throw new Error('Usage: node prepare.mjs --out NEW_EMPTY_DIRECTORY [--source-root REPO] [--candidate-root REPO]');
  }
  args.set(key, path.resolve(process.argv[i + 1]));
}
if (!args.has('--out')) throw new Error('--out is required');
const sourceRoot = args.get('--source-root') ?? defaultRoot;
const candidateRoot = args.get('--candidate-root') ?? defaultRoot;
const out = args.get('--out');
if (fs.existsSync(out) && fs.readdirSync(out).length) throw new Error('Output directory must be new or empty');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function exactUtf8(value, label) {
  if (value.includes('\ufffd')) throw new Error(`Invalid UTF-8 replacement character in ${label}`);
  if (value.includes('\r')) throw new Error(`Unreviewed CR/CRLF source in ${label}; no byte normalization is permitted`);
  return value;
}
const sourceRecords = [];
const excerpts = [];
function read(relative, root = sourceRoot, provenance = 'source') {
  const absolute = path.resolve(root, relative);
  const bytes = fs.readFileSync(absolute);
  const text = exactUtf8(bytes.toString('utf8'), relative);
  sourceRecords.push({ path: relative, root: provenance, sha256Bytes: hash(bytes), sha256UTF8Exact: hash(text) });
  return text;
}
const escapes = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function functionDDL(text, name, delimiter) {
  const marker = new RegExp(`^CREATE OR REPLACE FUNCTION public\\.${escapes(name)}\\s*\\(`, 'gm');
  const starts = [...text.matchAll(marker)];
  if (starts.length !== 1) throw new Error(`Expected one literal function ${name}; found ${starts.length}`);
  const start = starts[0].index;
  const open = text.indexOf(`AS ${delimiter}`, start);
  if (open < 0) throw new Error(`Missing exact AS ${delimiter} for ${name}`);
  const nextCreate = text.indexOf('\nCREATE OR REPLACE FUNCTION ', start + 1);
  if (nextCreate >= 0 && open > nextCreate) throw new Error(`Delimiter outside function ${name}`);
  const close = text.indexOf(delimiter, open + 3 + delimiter.length);
  if (close < 0 || text[close + delimiter.length] !== ';') throw new Error(`Missing exact terminator ${delimiter}; for ${name}`);
  const ddl = text.slice(start, close + delimiter.length + 1);
  excerpts.push({ kind: 'literal-function', name, delimiter, sha256UTF8Exact: hash(ddl) });
  return ddl;
}
function aclDDL(text, name) {
  const lines = text.split('\n').filter(line => /^(REVOKE|GRANT)\b/.test(line) && line.includes(`ON FUNCTION public.${name}(`));
  if (!lines.length || lines.some(line => !line.endsWith(';'))) throw new Error(`Missing literal single-line ACL for ${name}`);
  return lines.join('\n');
}
function auditDDL(text) {
  const marker = 'DO $mig$';
  if (text.split(marker).length !== 2 || text.split('$mig$;').length !== 2) throw new Error('AUD source does not contain exactly one expected DO $mig$');
  const ddl = text.slice(text.indexOf(marker), text.indexOf('$mig$;') + '$mig$;'.length);
  excerpts.push({ kind: 'literal-do', name: 'AUD-ANALISIS-7', delimiter: '$mig$', sha256UTF8Exact: hash(ddl) });
  return ddl;
}

const ola1 = read('supabase/migrations/20260827193052_6fd12712-cd48-48bf-8f7a-ba8708d6d885.sql');
const replay = read('supabase/migrations/20260902004000_replay_mirror_reemision_canonica.sql');
const closedPublic = read('supabase/migrations/20260902006000_cartera_pendiente_nc_inline.sql');
const ola17 = read('supabase/migrations/20260910231259_20a2074f-e5f7-4954-bd09-8ca2cf6160ef.sql');
const audit = read('supabase/migrations/20261001183654_1aaeec87-3e77-4e27-9d6e-d4db9842fb96.sql');
const forwardRelative = 'supabase/migrations/20261012010000_nc_publica_paridad_replay.sql';
const forward = read(forwardRelative, candidateRoot, 'candidate');
const matrix = exactUtf8(fs.readFileSync(path.join(here, 'matrix.sql'), 'utf8'), 'matrix.sql');
const schema = `-- Minimal isolated fixture. This is not the complete application schema.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TYPE public.estado_factura AS ENUM ('Borrador', 'Emitida', 'Parcialmente pagada', 'Pagada', 'Vencida', 'Cancelada', 'Sustituida');
CREATE TABLE public.facturas (id uuid PRIMARY KEY, total numeric, moneda text, tipo_cambio numeric, estado public.estado_factura, deleted_at timestamptz);
CREATE TABLE public.factura_notas_credito (id uuid PRIMARY KEY, factura_id uuid, monto numeric, moneda text, tipo_cambio numeric, estado text, deleted_at timestamptz);
CREATE TABLE public.pagos_factura (id uuid PRIMARY KEY, factura_id uuid, monto_aplicado_factura numeric, deleted_at timestamptz, estado_rep text);
`;
const setup = [schema,
  functionDDL(ola17, 'nc_convertida_a_moneda_factura', '$function$'), aclDDL(ola17, 'nc_convertida_a_moneda_factura'),
  functionDDL(ola17, 'pago_rep_anulado', '$function$'), aclDDL(ola17, 'pago_rep_anulado'),
  functionDDL(ola1, '_nc_aplicadas_moneda_factura', '$$'), aclDDL(ola1, '_nc_aplicadas_moneda_factura'),
  functionDDL(replay, 'nc_aplicadas_en_moneda_factura', '$function$'), aclDDL(closedPublic, 'nc_aplicadas_en_moneda_factura'),
  functionDDL(ola17, '_saldo_factura_calc', '$function$'), aclDDL(ola17, '_saldo_factura_calc'),
].join('\n\n') + '\n';
const files = {
  'setup.sql': setup,
  'historical-audit.sql': auditDDL(audit) + '\n',
  'forward.sql': forward,
  'matrix.sql': matrix,
  'driver.sql': '\\set ON_ERROR_STOP on\n\\ir setup.sql\n\\ir historical-audit.sql\n\\ir matrix.sql\n',
};
fs.mkdirSync(out, { recursive: true });
for (const [name, value] of Object.entries(files)) fs.writeFileSync(path.join(out, name), value, { flag: 'wx' });
const manifest = {
  format: 1,
  scope: 'Minimal SQL reproduction, not full-schema replay or hosted-state verification',
  requiredPostgres: '17.9',
  sources: sourceRecords,
  excerpts,
  preparedFiles: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, hash(value)])),
  securityFixture: 'Literal historical ACL: inner INVOKER authenticated/service_role; public and saldo DEFINER service_role; owner postgres from fresh initdb',
};
fs.writeFileSync(path.join(out, 'source-hashes.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'prepared-only', requiredPostgres: '17.9', sourceFiles: sourceRecords.length, literalFunctions: excerpts.filter(x => x.kind === 'literal-function').length, out }));
