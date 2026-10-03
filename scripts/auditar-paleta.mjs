#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Auditoría de consistencia de paleta.

   Busca colores hardcodeados que NO pertenezcan al sistema de tokens.

   CLAVE DEL DISEÑO: la lista de colores válidos se LEE de variables.css, no se
   mantiene a mano. Las dos veces que se escaparon colores durante la migración
   de identidad fue por usar una lista manual: buscaba solo las notaciones ya
   contempladas, así que quedaba ciega al resto (tripletas rgb del marino, un
   verde apagado que no estaba en la lista, hex de 8 dígitos con alfa...).

   Uso:    node scripts/auditar-paleta.mjs
   Salida: código 1 si hay colores fuera del sistema (sirve para CI).
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const RAIZ = 'src';
const PALETA = 'src/shared/styles/variables.css';

// Absolutos: no son deriva de paleta. Blanco y negro se usan tal cual a
// propósito (texto sobre sólidos, sombras).
const ABSOLUTOS = new Set(['#fff', '#ffffff', '#000', '#000000']);

// Todo hex que aparezca en variables.css es, por definición, del sistema.
// Se toman TODOS los del archivo (no uno por declaración): varios tokens
// declaran degradados con varias paradas y esas paradas también son paleta.
const delSistema = new Set(
  [...fs.readFileSync(PALETA, 'utf8').matchAll(/#[0-9a-fA-F]{3,8}/g)]
    .map((m) => m[0].toLowerCase()),
);

const hallazgos = [];

function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { recorrer(f); continue; }
    if (!/\.(css|jsx)$/.test(e.name)) continue;
    if (e.name === 'variables.css') continue;   // es la paleta: su sitio natural

    const rel = f.split(path.sep).join('/');
    const lineas = fs.readFileSync(f, 'utf8').split('\n');

    lineas.forEach((linea, i) => {
      // Los comentarios no pintan nada.
      if (/^\s*(\/\*|\*|\/\/)/.test(linea)) return;
      for (const m of linea.matchAll(/#[0-9a-fA-F]{3,8}/g)) {
        const c = m[0].toLowerCase();
        if (c.length === 9 || c.length === 5) continue;   // con canal alfa
        if (ABSOLUTOS.has(c)) continue;
        if (delSistema.has(c)) continue;
        hallazgos.push({ rel, l: i + 1, c, txt: linea.trim().slice(0, 70) });
      }
    });
  }
}

recorrer(RAIZ);

console.log(`paleta: ${delSistema.size} valores definidos en ${PALETA}`);

if (hallazgos.length === 0) {
  console.log('✓ cero colores fuera del sistema de tokens');
  process.exit(0);
}

console.log(`\n✗ ${hallazgos.length} colores fuera del sistema:\n`);
for (const h of hallazgos) {
  console.log(`  ${h.rel}:${h.l}  ${h.c}`);
  console.log(`      ${h.txt}`);
}
process.exit(1);
