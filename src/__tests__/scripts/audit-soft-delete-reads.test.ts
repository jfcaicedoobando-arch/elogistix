import { describe, it, expect } from "vitest";
import { claveDe, lecturaProtegida, ventanaConsulta, type Hallazgo } from "../../../scripts/audit-soft-delete-reads";

function hallazgo(archivo: string, tabla = "clientes"): Hallazgo {
  return { archivo, tabla, linea: 12, tipo: "puntual" };
}

describe("identidad portable de lecturas con borrado lógico", () => {
  it("la misma lectura Windows/Linux corresponde a la misma entrada histórica", () => {
    const linux = "src/features/facturacion/services/datosFiscalesCliente.ts";
    const windows = "src\\features\\facturacion\\services\\datosFiscalesCliente.ts";
    const baseline = new Set([`${linux}::clientes`]);
    expect(baseline.has(claveDe(hallazgo(windows)))).toBe(true);
    expect(claveDe(hallazgo(windows))).toBe(claveDe(hallazgo(linux)));
  });
  it("separadores mixtos se normalizan, archivos y tablas diferentes conservan su identidad", () => {
    expect(claveDe(hallazgo("src/features\\cliente/services/crud.ts"))).toBe("src/features/cliente/services/crud.ts::clientes");
    expect(claveDe(hallazgo("src/features/cliente/services/crud.ts", "contactos_cliente"))).not.toBe(claveDe(hallazgo("src/features/cliente/services/crud.ts")));
    expect(claveDe(hallazgo("src/features/cliente/services/contactos.ts"))).not.toBe(claveDe(hallazgo("src/features/cliente/services/crud.ts")));
  });
  it("una ruta nueva sigue siendo fuga y una deuda ausente sigue siendo obsoleta", () => {
    const deuda = "src/features/cliente/services/crud.ts::clientes";
    const baseline = new Set([deuda]);
    const actuales = [hallazgo("src\\features\\cliente\\services\\nuevo.ts")].map(claveDe);
    expect(actuales.filter((key) => !baseline.has(key))).toEqual(["src/features/cliente/services/nuevo.ts::clientes"]);
    expect([...baseline].filter((key) => !actuales.includes(key))).toEqual([deuda]);
  });
  it("normalizar la clave no convierte una lectura sin filtro en lectura protegida", () => {
    const consulta = 'supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle();';
    expect(lecturaProtegida(ventanaConsulta(consulta, consulta.indexOf(".from(")))).toBe(false);
    const protegida = 'supabase.from("clientes").select("id").is("deleted_at", null).maybeSingle();';
    expect(lecturaProtegida(ventanaConsulta(protegida, protegida.indexOf(".from(")))).toBe(true);
  });
});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analizarContenido, actualizarBaseline } from "../../../scripts/audit-soft-delete-reads";

const detecta = (source: string) => analizarContenido(source).map(h => h.tabla).sort();
const lectura = "db.from('clientes').select('id')";
const filtro = ".is('deleted_at', null)";

describe("predicado del builder exacto, sin texto vecino", () => {
  it.each([
    ["columna seleccionada", "await db.from('clientes').select('id, deleted_at');"],
    ["comentario", "await db.from('clientes') /* agregar deleted_at */ .select('id');"],
    ["string", `await ${lectura}.eq('nota', '.is(\\"deleted_at\\", null)');`],
    ["campo de relación", `await ${lectura}.is('cliente.deleted_at', null);`],
    ["valor distinto de null", `await ${lectura}.is('deleted_at', false);`],
    ["valor variable", `await ${lectura}.is('deleted_at', value);`],
    ["eq no equivale a IS NULL", `await ${lectura}.eq('deleted_at', null);`],
    ["lectura siguiente filtrada", `await ${lectura}; await db.from('facturas').select('id')${filtro};`],
    ["otra función", `async function a(){ return ${lectura}; } async function b(){ return db.from('facturas').update({})${filtro}; }`],
    ["otro builder", `const q=${lectura}; const r=db.from('facturas').select('id'); r.is('deleted_at',null); await q; await r;`],
    ["lectura antes del filtro", `const q=${lectura}; await q; q.is('deleted_at',null); await q;`],
    ["closure no ejecutado", `const q=${lectura}; const later=()=>q.is('deleted_at',null); await q;`],
    ["shadowing", `const q=${lectura}; { const q=db.from('facturas').select('id')${filtro}; await q; } await q;`],
    ["filtro de una rama", `let q=${lectura}; if(flag) q=q.is('deleted_at',null); await q;`],
    ["filtro de cortocircuito", `const q=${lectura}; flag && q.is('deleted_at',null); await q;`],
    ["filtro de ternario", `let q=${lectura}; q=flag?q.is('deleted_at',null):q; await q;`],
    ["filtro de loop opcional", `const q=${lectura}; while(flag){ q.is('deleted_at',null); } await q;`],
    ["marker dentro de string", `await ${lectura}.eq('nota','SOFT-DELETE-OK: papelera');`],
    ["marker sin motivo", "await db.from('clientes') /* SOFT-DELETE-OK: */ .select('id');"],
    ["marker de consulta posterior", `await ${lectura}; await db.from('facturas') /* SOFT-DELETE-OK: papelera */ .select('id');`],
  ])("detecta %s", (_name, source) => {
    expect(detecta(source)).toEqual(["clientes"]);
  });

  it.each([
    ["cadena directa", `await ${lectura}${filtro};`],
    ["builder reasignado", `let q=${lectura}; q=q.is('deleted_at',null); await q;`],
    ["builder mutado", `const q=${lectura}; q.is('deleted_at',null); await q;`],
    ["alias del mismo builder", `const q=${lectura}; const alias=q; alias.is('deleted_at',null); await q;`],
    ["paréntesis y casts", `let q=(${lectura} as unknown as Builder); q=(q!).is('deleted_at',null); await q;`],
    ["ambas ramas", `let q=${lectura}; if(flag){q=q.is('deleted_at',null);}else{q=q.is('deleted_at',null);} await q;`],
    ["guard clause", `async function f(){let q=${lectura}; if(flag) return null; q=q.is('deleted_at',null); return q;}`],
    ["más de sesenta líneas", `const q=${lectura};\n${"// comentario\n".repeat(75)}q.is('deleted_at',null); await q;`],
    ["select separado", "let q=db.from('clientes'); q=q.select('id'); q=q.is('deleted_at',null); await q;"],
    ["excepción intencional local", "await db.from('clientes') // SOFT-DELETE-OK: papelera deliberada\n.select('id');"],
    ["excepción local en bloque", "await db.from('clientes') /* SOFT-DELETE-OK: papelera deliberada */ .select('id');"],
  ])("conserva %s", (_name, source) => expect(detecta(source)).toEqual([]));

  it("no transfiere filtro al reemplazar el builder", () => {
    expect(detecta(`let q=${lectura}${filtro}; q=db.from('facturas').select('id'); await q;`)).toEqual(["facturas"]);
  });
  it("conserva el origen no filtrado al mantener un alias", () => {
    expect(detecta(`let q=${lectura}; const alias=q; q=db.from('facturas').select('id')${filtro}; await alias; await q;`)).toEqual(["clientes"]);
  });
  it("dos lecturas de una tabla mantienen líneas independientes", () => {
    const findings = analizarContenido(`await ${lectura};\nawait ${lectura}${filtro};\nawait ${lectura};`, "ruta.ts");
    expect(findings.map(h => [h.archivo, h.linea])).toEqual([["ruta.ts", 1], ["ruta.ts", 3]]);
  });
});

describe("clases de consulta y tablas", () => {
  it.each(["insert", "update", "upsert", "delete"])("%s con select de retorno sigue siendo escritura", operation => {
    expect(detecta(`await db.from('clientes').${operation}({}).select('id');`)).toEqual([]);
  });
  it("from sin select no se declara lectura", () => expect(detecta("const q=db.from('clientes');")).toEqual([]));
  it("select agregado después sí es lectura", () => expect(detecta("let q=db.from('clientes'); q=q.select('id'); await q;")).toEqual(["clientes"]));
  it("storage es receptor AST, no texto o comentario vecino", () => {
    expect(detecta("await db.storage.from('clientes').list();")).toEqual([]);
    expect(detecta(`const memo='storage'; await ${lectura};`)).toEqual(["clientes"]);
  });
  it("resuelve ambas ramas literales conocidas", () => {
    expect(detecta("await db.from(tipo==='cxc'?'pagos_factura':'pagos_proveedor').select('id');")).toEqual(["pagos_factura", "pagos_proveedor"]);
    expect(detecta(`await db.from(tipo==='cxc'?'pagos_factura':'pagos_proveedor').select('id')${filtro};`)).toEqual([]);
  });
  it("no incorpora tablas conocidas sin borrado lógico", () => {
    expect(detecta("await db.from(flag?'clientes':'otra_tabla').select('id');")).toEqual(["clientes"]);
  });
  it("tablas dinámicas no resolubles quedan explícitas, sin aprobación implícita", () => {
    expect(detecta("await db.from(tabla).select('id');")).toEqual(["<tabla dinámica no resuelta>"]);
    expect(detecta("await db.from(flag?'clientes':tabla).select('id');")).toEqual(["<tabla dinámica no resuelta>", "clientes"]);
  });
  it("from con espacios, template estático y TSX mantiene detección", () => {
    expect(detecta("await db.from \n (`clientes`).select('id');")).toEqual(["clientes"]);
    expect(analizarContenido("const C=()=> <div/>; async function f(){return db.from('clientes').select('id');}", "file.tsx")).toHaveLength(1);
  });
  it("no omite consultas dentro de switch o inicializador de for", () => {
    expect(detecta("switch(x){case 1: await db.from('clientes').select('id'); break;}")).toEqual(["clientes"]);
    expect(detecta("for(let q=db.from('clientes').select('id'); flag; step()){ await q; }")).toEqual(["clientes"]);
  });
});

describe("--update sólo puede reducir el conjunto", () => {
  function withBaseline(initial: unknown, action: (path: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), "soft-delete-baseline-"));
    const path = join(dir, "baseline.json");
    writeFileSync(path, JSON.stringify(initial));
    try { action(path); } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  it.each([
    ["crece", ["a", "b", "c", "nueva"]],
    ["sustituye con el mismo tamaño", ["a", "b", "nueva"]],
    ["sustituye incluso con menos claves", ["nueva"]],
  ])("rechaza y no escribe cuando %s", (_name, keys) => {
    withBaseline({ deuda: ["a", "b", "c"] }, path => {
      const before = readFileSync(path);
      expect(() => actualizarBaseline(keys, path)).toThrow("clave(s) nueva(s)");
      expect(readFileSync(path)).toEqual(before);
    });
  });
  it("permite subconjunto, vaciado e igualdad sin duplicados", () => {
    withBaseline({ deuda: ["b", "a"] }, path => {
      actualizarBaseline(["a", "b", "a"], path);
      expect(JSON.parse(readFileSync(path, "utf8")).deuda).toEqual(["a", "b"]);
      actualizarBaseline(["b"], path);
      expect(JSON.parse(readFileSync(path, "utf8")).deuda).toEqual(["b"]);
      actualizarBaseline([], path);
      expect(JSON.parse(readFileSync(path, "utf8")).deuda).toEqual([]);
    });
  });
  it.each([{}, { deuda: "a" }, { deuda: [1] }])("baseline inválida no se pisa: %j", initial => {
    withBaseline(initial, path => {
      const before = readFileSync(path);
      expect(() => actualizarBaseline([], path)).toThrow();
      expect(readFileSync(path)).toEqual(before);
    });
  });
});

describe("wrappers AST y orígenes reutilizables", () => {
  it.each([
    ["objeto con alias", `async function f(){const q=${lectura}; return {query:q};}`],
    ["array con alias", `async function f(){const q=${lectura}; return [q];}`],
    ["template con await", "const s=`${await db.from('clientes').select('id')}`;"],
    ["Promise.all con objeto", `await Promise.all(Object.values({q:${lectura}}));`],
    ["objeto destructurado invalida alias", `let q=${lectura}; const r=q; ({q}=other); q.is('deleted_at',null); await r;`],
    ["array destructurado invalida alias", `let q=${lectura}; const r=q; [q]=other; q.is('deleted_at',null); await r;`],
    ["dos select del mismo root", `const table=db.from('clientes'); await table.select('id')${filtro}; await table.select('id');`],
    ["write no contamina select nuevo", "const table=db.from('clientes'); await table.update({x:1}); await table.select('id');"],
  ])("detecta %s", (_name, source) => expect(detecta(source)).toEqual(["clientes"]));
  it("dos select filtrados del mismo root son seguros", () => {
    expect(detecta(`const table=db.from('clientes'); await table.select('id')${filtro}; await table.select('id')${filtro};`)).toEqual([]);
  });
  it("propiedad literal no consume un alias homónimo", () => {
    expect(detecta(`const q=${lectura}; const obj={q:42}; q.is('deleted_at',null); await q;`)).toEqual([]);
  });
});

describe("capturas conservadoras: un helper opaco no certifica el filtro", () => {
  it.each([
    `const q=${lectura}; const run=()=>q; await run(); q.is('deleted_at',null);`,
    `function run(){return q;} const q=${lectura}; await run(); q.is('deleted_at',null);`,
    `async function f(){const q=${lectura}; return ()=>q;}`,
    `const q=${lectura}; register(()=>q); q.is('deleted_at',null);`,
  ])("no oculta consulta capturada: %s", source => expect(detecta(source)).toEqual(["clientes"]));
  it("una captura ya protegida no crea hallazgo", () => {
    expect(detecta(`const q=${lectura}${filtro}; const run=()=>q; await run();`)).toEqual([]);
  });
  it("el parámetro homónimo de otra función no captura el builder", () => {
    expect(detecta(`const q=${lectura}; function helper(q){return q;} q.is('deleted_at',null); await q;`)).toEqual([]);
  });
});

describe("consumos conservadores en control de flujo y métodos", () => {
  it.each([
    "const table=db.from('clientes'); switch(k){case 1:await table.select('id'); break;}",
    `const q=${lectura}; switch(k){case 1:await q; break;} q.is('deleted_at',null);`,
    "for(const table=db.from('clientes'); flag; step()){await table.select('id');}",
    `const q=${lectura}; const obj={run(){return q;}}; await obj.run(); q.is('deleted_at',null);`,
    `const q=${lectura}; class C{run(){return q;}} await new C().run(); q.is('deleted_at',null);`,
    `const q=${lectura}; const make=()=>()=>q; await make()(); q.is('deleted_at',null);`,
  ])("no aprueba %s", source => expect(detecta(source)).toEqual(["clientes"]));
});

it("no omite builders exportados desde un namespace", () => {
  expect(detecta("namespace X { export const q=db.from('clientes').select('id'); }")).toEqual(["clientes"]);
});
