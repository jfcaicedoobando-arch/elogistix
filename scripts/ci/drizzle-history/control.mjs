/** Read-only verification/listing of test-only history; never connects to a DB. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const DIR = 'scripts/ci/drizzle-history';
const COMMIT = 'ec96cf2e4bbb4443be463f1496da0189df2d1bef';
const ARCHIVE = `archive/${COMMIT}`;
// Explicit historical order: the archived idx 22 predates the current idx 22.
export const HISTORY = [
  { file: '0021_refacturar_proforma_rpc.sql', sha256: '8f5c299f5c593fe398e620056d8a2971a9f9ed4e90940310df173023fa9572e5', eligibleName: '20261026184800_replay_refacturar_proforma_rpc.sql' },
  { file: `${ARCHIVE}/0022_refacturar_proforma_abre_edicion.sql`, sha256: '8b4272fdc0abdbbbedac41c46e28694f611a59c240e0509bdf02ec2f8b9446fa' },
  { file: '0022_cotizacion_comercial.sql', sha256: '5cc034df0035d1f9b1722aa9bfad12ff68965bde22273500f55903bf9b60ed38', eligibleName: '20261026184900_replay_cotizacion_comercial.sql' },
  { file: '0023_margen_minimo_utilidad_rpc.sql', sha256: 'b106eb27b920f2d34825e9141a46d2ed51943c4ccad69cca8c2f970d2348c86a', eligibleName: '20261026185000_replay_margen_minimo_utilidad_rpc.sql' },
  // Current 0026–0048 follow the earlier isolated sources in journal order.
  { file: '0026_comisiones_recalcular_al_asignar_vendedora.sql', sha256: '5076f939bde9c6fe4bd2798f5690c8163c636165ec9ced561af170bb986f5e03', eligibleName: '20261106000000_replay_comisiones_recalcular_al_asignar_vendedora.sql' },
  { file: '0027_clientes_tipo_cliente.sql', sha256: '5a325b83b2365e11ceb2d0ce3c5796a645b6ae4e991752b0b782d6c589b13be4', eligibleName: '20261106010000_replay_clientes_tipo_cliente.sql' },
  { file: '0028_pricing_tipo_operacion_sector.sql', sha256: 'ea21108f86701bccffa72615886df94d9538825a37d938cda5e2b496186f5eb0', eligibleName: '20261106020000_replay_pricing_tipo_operacion_sector.sql' },
  { file: '0029_cotizacion_handover.sql', sha256: '05945750400de4633ecfc21823d1d8989feda8385645d0e8130240d9d7a7757c', eligibleName: '20261106030000_replay_cotizacion_handover.sql' },
  { file: '0030_pricing_reglas_plazos.sql', sha256: '4a8714a7515e5a7074f173be388f9e88f12f147b0109237dfd956d5a61123271', eligibleName: '20261106040000_replay_pricing_reglas_plazos.sql' },
  { file: '0031_cotizacion_autorizacion.sql', sha256: 'a816f3bf9741eb94f98ab36ea6e5f6cc882ac4e5ffb4228d49fb8bd2a1e191be', eligibleName: '20261106050000_replay_cotizacion_autorizacion.sql' },
  { file: '0032_cliente_especial_sin_autorizacion.sql', sha256: '4fc32a90805b39d55b133317177931ce5613154b475fd9ef7e916708ca6e8a35', eligibleName: '20261106060000_replay_cliente_especial_sin_autorizacion.sql' },
  { file: '0033_handover_embarque_al_aceptar.sql', sha256: 'f0dc291eb349afcc3a3c770d19e3717b56b528e02010680375eab599fd0bfb59', eligibleName: '20261106070000_replay_handover_embarque_al_aceptar.sql' },
  { file: '0034_prospecto_solo_borrador.sql', sha256: 'b4daeecf283e43b5e85ab0fc1dec0f1c322c4a0150549c5d4bbb23b48210e0b5', eligibleName: '20261106080000_replay_prospecto_solo_borrador.sql' },
  // Forward fix after 0029's table and the complete immutable history.
  { file: '0035_cotizacion_aceptada_hasta_confirmar_embarque.sql', sha256: '9565c53c94e45d33bdf96242937dbaa0036dd7b122f0b7018739b0fe5128c277', eligibleName: '20261106090000_replay_cotizacion_aceptada_hasta_confirmar_embarque.sql' },
  { file: '0036_cotizacion_handover_tenant_scope.sql', sha256: 'a72308bf9b13502051fa0b212c43c81a4a69589cd5dc4ac0bec249f805c5ce1a', eligibleName: '20261106100000_cotizacion_handover_tenant_scope.sql' },
  { file: '0037_cotizacion_especial_trigger_permissions.sql', sha256: 'e398f843fa18c56f4cfd222d6329c24c3e259c406b817dbac2d7bab5fbb62eb0', eligibleName: '20261106110000_cotizacion_especial_trigger_permissions.sql' },
  { file: '0038_coordinador_fijo_por_cliente.sql', sha256: '6df25cd241868aea34f5d245db90ddc7de931b0fcce5268795eaf22706802c93', eligibleName: '20261106120000_coordinador_fijo_por_cliente.sql' },
  { file: '0039_cotizacion_margen_moneda_homogenea.sql', sha256: '4d20a86450c946c2d73845dbf41ff93d4fb93490243f8967737d1165bd163f79', eligibleName: '20261106130000_cotizacion_margen_moneda_homogenea.sql' },
  { file: '0040_coordinador_permission_boundary.sql', sha256: 'b50b05b0f00dad9cac4ad6257ef8fa7676eca1a51e686513947e53425723fa6a', eligibleName: '20261106140000_coordinador_permission_boundary.sql' },
  { file: '0041_prospecto_housekeeping_historicos.sql', sha256: '4bc3ec9e2f34c10bd7091e8f1b9eb5e3458dce2b3f6d7664d8eec129fd27fd53', eligibleName: '20261108174500_prospecto_housekeeping_historicos.sql' },
  // Forward fixes 2026-11-08: legacy changes that never reached production.
  { file: '0042_periodo_cerrado_campos_derivados.sql', sha256: 'f342ee211925de673df88f4bcc6343e0ca0a33c2cab34659fe0972b49d929d65', eligibleName: '20261108190000_periodo_cerrado_campos_derivados.sql' },
  { file: '0043_bitacora_no_falsificable.sql', sha256: '54de7ba7ff1cee2d1850a3db1557e991780b963351e0724d5729549eea8964ac', eligibleName: '20261108191000_bitacora_no_falsificable.sql' },
  { file: '0044_efe_xml_hash_unico_vivo.sql', sha256: 'c8b73a21472318ffffaa5a9dcb7d5ce5160d80bee15668c82962c0b8d5bbe44f', eligibleName: '20261108192000_efe_xml_hash_unico_vivo.sql' },
  { file: '0045_provision_owner_sin_membresia.sql', sha256: 'bd14472b11d4009f5439daf045e3703d0fe3910cb73dce650c160956e62c23b6', eligibleName: '20261108193000_provision_owner_sin_membresia.sql' },
  { file: '0046_cerrar_funciones_internas_abiertas.sql', sha256: 'fbb3f321e91f0ffb29098ff38e16c9ac0424d1f7c21ed9a5e97950e015d15001', eligibleName: '20261108194000_cerrar_funciones_internas_abiertas.sql' },
  { file: '0047_rls_auth_uid_initplan_backport.sql', sha256: '49f067b89ca5bdbc31299d621e05279639862799d0892d71cbce3cb8ea09d22a', eligibleName: '20261108195000_rls_auth_uid_initplan_backport.sql' },
  { file: '0048_limpieza_indices_duplicados.sql', sha256: '9e135244f1f96d2b03e2abc35c3deb1efa3d44f3ee85162f52cf16eecfba7645', eligibleName: '20261108200000_limpieza_indices_duplicados.sql' },
  { file: '0049_liquidaciones_lectura_finanzas_gerentes.sql', sha256: '7ba8e14da36f37a6559f05cf427a7d1e1e9dc495fed332b9f387f75c5d589d64', eligibleName: '20261108201000_liquidaciones_lectura_finanzas_gerentes.sql' },
  { file: '0050_registrar_evento_tracking_embarque.sql', sha256: 'da871c7f6eb9dfd3811302783470944a3c397167b09341efd7d617bb33db6753', eligibleName: '20261111044000_registrar_evento_tracking_embarque.sql' },
  { file: '0051_procesamiento_facturapi_webhook.sql', sha256: '0dd5e001a5a86dbb87e8f5c200fe2226ae2b948aebcc23ec9e795365de64e938', eligibleName: '20261111045200_procesamiento_facturapi_webhook.sql' },
  { file: '0052_envios_proforma_recuperables.sql', sha256: '872fa26220264cf26cf2a85c0ae41b274e9361979540d76a8656502b0700faba', eligibleName: '20261111053500_envios_proforma_recuperables.sql' },
  { file: '0053_provision_membresia_atomica.sql', sha256: '4b519d836748bf04174aae1353f1ab160996904ff6d180b001e587c4b492231e', eligibleName: '20261111054500_provision_membresia_atomica.sql' },
];
const ARCHIVED_METADATA = [
  [`${ARCHIVE}/meta/0022_snapshot.json`, '002a1cff39197fe3431f23193a4229e1c845cbcd0ab5eaa074efded812b0081d'],
  [`${ARCHIVE}/meta/_journal.json`, '10745ad2cc8bcbf4a6559dda414296966a372ca162fbd6e1ac3d6b382eb96288'],
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(root, file, expected) {
  const bytes = fs.readFileSync(path.join(root, DIR, file));
  if (hash(bytes) !== expected) throw new Error(`Isolated history hash mismatch: ${file}`);
  return bytes.toString('utf8');
}

function rejectEligibleCopies(root) {
  const forbidden = new Set(HISTORY.map(item => item.sha256));
  const dir = path.join(root, 'supabase/migrations');
  for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.sql'))) {
    if (forbidden.has(hash(fs.readFileSync(path.join(dir, file))))) {
      throw new Error(`Test-only replay must not be deployment-eligible: ${file}`);
    }
  }
}

/** Returns only the current journal sources; recovered history is verified too. */
export function readIsolatedDrizzleReplay(root = process.cwd()) {
  const mapping = JSON.parse(fs.readFileSync(path.join(root, 'drizzle/replay.json'), 'utf8'));
  rejectEligibleCopies(root);
  const out = new Map();
  for (const item of HISTORY) {
    const sql = pinned(root, item.file, item.sha256);
    if (!item.eligibleName) continue;
    const source = fs.readFileSync(path.join(root, 'drizzle/migrations', item.file));
    if (hash(source) !== item.sha256) throw new Error(`Immutable source changed: ${item.file}`);
    if (fs.existsSync(path.join(root, 'supabase/migrations', item.eligibleName))) {
      throw new Error(`Test-only replay must not be deployment-eligible: ${item.eligibleName}`);
    }
    const entries = mapping.filter(entry => entry.file === item.file);
    if (entries.length !== 1 || entries[0].scope !== 'isolated-ci'
      || entries[0].sha256 !== item.sha256 || entries[0].composition
      || JSON.stringify(entries[0].replays) !== JSON.stringify([item.file])) {
      throw new Error(`Isolated history mapping mismatch: ${item.file}`);
    }
    out.set(item.file, sql);
  }
  if (mapping.filter(entry => entry.scope === 'isolated-ci').length !== out.size) {
    throw new Error('Unreviewed isolated history mapping');
  }
  for (const [file, expected] of ARCHIVED_METADATA) pinned(root, file, expected);
  return out;
}

export function listIsolatedHistory(root = process.cwd()) {
  readIsolatedDrizzleReplay(root);
  return HISTORY.map(item => `${DIR}/${item.file}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] !== 'list') throw new Error('Usage: node control.mjs list');
  console.log(listIsolatedHistory().join('\n'));
}
