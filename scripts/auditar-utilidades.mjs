#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Utilidades de Tailwind escritas en el JSX que NO llegaron al CSS compilado.

   EL FALLO QUE DETECTA
   Si se escribe `border-accent-soft-border` y el token --color-accent-soft-border
   no existe, Tailwind simplemente NO genera la regla. No hay error, no hay
   warning, el build pasa limpio y el estilo falta en pantalla. Pasó: ese borde
   ámbar del banner de novedades de Empleados no se aplicaba, y solo se vio al
   comprobar a mano si la utilidad existía en el bundle.

   Lo mismo ocurre con un typo (`bg-sufrace`) o con una variante mal escrita.

   CÓMO LO COMPRUEBA
   Compara los candidatos que aparecen en los className del código contra las
   clases realmente presentes en dist/. El CSS compilado es la fuente de verdad:
   si Tailwind la generó, está ahí; si no, el candidato está muerto.

   Requiere un build previo (lee dist/assets/*.css).

   Uso:    npm run build && node scripts/auditar-utilidades.mjs
   Salida: código 1 si hay utilidades muertas.
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const DIST = 'dist/assets';
if (!fs.existsSync(DIST)) {
  console.error('✗ no hay dist/. Corré `npm run build` antes.');
  process.exit(2);
}

/* ── 1. Clases presentes en el CSS compilado ──
   Los selectores vienen escapados (`.bg-primary\/50`, `.max-lg\:ml-0`), así que
   se deshace el escapado para comparar contra lo que se escribe en el JSX. */
const generadas = new Set();
for (const f of fs.readdirSync(DIST).filter((n) => n.endsWith('.css'))) {
  const css = fs.readFileSync(path.join(DIST, f), 'utf8');
  for (const m of css.matchAll(/\.((?:[\w-]|\\.)+)(?=[\s,{:>+~[])/g)) {
    generadas.add(m[1].replace(/\\(.)/g, '$1'));
  }
}

/* ── 2. Candidatos escritos en el código ──
   Solo de cadenas que están en un className o en una constante de clases (las
   de este proyecto son const en MAYÚSCULAS con utilidades dentro). Mirar todas
   las cadenas del archivo daría falsos positivos con texto normal. */
const PREFIJOS = /^(bg|text|border|shadow|ring|outline|fill|stroke|from|via|to|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|size|w|h|min-w|min-h|max-w|max-h|rounded|font|tracking|leading|aspect|duration|ease|col-span|grid-cols|flex|items|justify|opacity|z)-/;

const candidatos = new Map();   // clase -> [archivos]
const esUtilidad = (t) => PREFIJOS.test(t) && !t.includes('${') && !t.includes('(');

function registrar(clase, rel) {
  if (!candidatos.has(clase)) candidatos.set(clase, new Set());
  candidatos.get(clase).add(rel);
}

(function rec(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { rec(f); continue; }
    if (!/\.(jsx|js)$/.test(e.name)) continue;
    const rel = f.split(path.sep).join('/');
    const src = fs.readFileSync(f, 'utf8');

    const cadenas = [
      ...[...src.matchAll(/className=["'`]([^"'`]*)["'`]/g)].map((m) => m[1]),
      // Constantes de clases: const NOMBRE = '...' (y sus concatenaciones)
      ...[...src.matchAll(/^const [A-Z][A-Z0-9_]*\s*=\s*((?:\s*\+?\s*['"][^'"]*['"])+)/gm)]
        .flatMap((m) => [...m[1].matchAll(/['"]([^'"]*)['"]/g)].map((x) => x[1])),
    ];

    for (const cadena of cadenas) {
      for (const token of cadena.split(/\s+/)) {
        if (!token || !esUtilidad(token)) continue;
        registrar(token, rel);
      }
    }
  }
})('src');

/* ── 3. Comparación ── */
const muertas = [...candidatos.entries()].filter(([c]) => !generadas.has(c));

console.log(`${generadas.size} clases en dist · ${candidatos.size} candidatos en el código`);

if (!muertas.length) {
  console.log('✓ todas las utilidades usadas existen en el CSS compilado');
  process.exit(0);
}

console.log(`\n✗ ${muertas.length} utilidad(es) escritas pero NO generadas`);
console.log('    (token inexistente, typo o variante inválida: el estilo falta en silencio)\n');
for (const [clase, archivos] of muertas) {
  console.log(`  ${clase}`);
  for (const a of archivos) console.log(`      ${a}`);
}
process.exit(1);
