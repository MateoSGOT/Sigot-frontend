#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Auditoría del contenedor de tablas.

   Table.css resuelve el paso "tabla → tarjetas apiladas" con
   `@container tabla (max-width: 768px)`. Una consulta de contenedor CON NOMBRE
   solo coincide si existe un ancestro que declare `container-name: tabla`, y eso
   lo hace `.table-shell`.

   Consecuencia: un `.table-wrapper` sin `.table-shell` por encima NO falla, no
   avisa y no rompe el build -- simplemente deja de volverse tarjetas en el
   celular. Es una regresión invisible, y pasó: DashboardPage tenía una tabla
   escrita a mano, fuera del componente compartido.

   Este script la vuelve visible.

   Uso:    node scripts/auditar-tablas.mjs
   Salida: código 1 si falta algún contenedor (sirve para CI).
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const RAIZ = 'src';
const hallazgos = [];

function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { recorrer(f); continue; }
    if (!/\.jsx$/.test(e.name)) continue;

    const src = fs.readFileSync(f, 'utf8');
    const wrappers = (src.match(/className="table-wrapper"/g) || []).length;
    if (wrappers === 0) continue;

    const rel = f.split(path.sep).join('/');
    const shells = (src.match(/className="table-shell"/g) || []).length;

    if (shells === 0) {
      hallazgos.push({ rel, msg: `${wrappers} .table-wrapper sin ningún .table-shell en el archivo` });
    } else if (shells < wrappers) {
      hallazgos.push({ rel, msg: `${wrappers} .table-wrapper pero solo ${shells} .table-shell` });
    }
  }
}

recorrer(RAIZ);

// Comprobación del propio CSS: si alguien renombra el contenedor en un lado y no
// en el otro, el nombre deja de coincidir y las tablas no se adaptan.
const css = fs.readFileSync('src/shared/components/Table/Table.css', 'utf8');
const nombreDeclarado = css.match(/container-name:\s*([\w-]+)/)?.[1];
const nombresConsultados = [...css.matchAll(/@container\s+([\w-]+)\s*\(/g)].map((m) => m[1]);
const desalineados = [...new Set(nombresConsultados)].filter((n) => n !== nombreDeclarado);

if (!nombreDeclarado) {
  hallazgos.push({ rel: 'Table.css', msg: 'no declara container-name: las consultas con nombre nunca coincidirán' });
}
for (const n of desalineados) {
  hallazgos.push({ rel: 'Table.css', msg: `@container "${n}" no coincide con el container-name declarado ("${nombreDeclarado}")` });
}

console.log(`contenedor declarado: "${nombreDeclarado}" · consultas: ${nombresConsultados.length}`);

if (hallazgos.length === 0) {
  console.log('✓ todas las tablas tienen su contenedor de consulta');
  process.exit(0);
}

console.log(`\n✗ ${hallazgos.length} problema(s):\n`);
for (const h of hallazgos) console.log(`  ${h.rel}\n      ${h.msg}`);
process.exit(1);
