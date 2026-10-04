#!/usr/bin/env node
/* Extrae de una hoja CSS solo las reglas que mencionan ciertas clases,
   conservando enteros los bloques @media/@supports/@container.

   Uso: node scripts/extraer-css.mjs <origen.css> <clase1,clase2,...>

   Hace una PRUEBA DE IDA Y VUELTA antes de filtrar: trocea el archivo y lo
   reconstruye; si el resultado no es byte a byte el original, aborta. Un parser
   de CSS escrito a mano es fácil de romper -- el primer intento de esto sacaba
   las reglas de dentro de los @media como si fueran de primer nivel y dejaba el
   `@media {` huérfano, lo que reventaba el build con "Missing opening {". */
import fs from 'fs';

const [origen, clasesArg] = process.argv.slice(2);
if (!origen || !clasesArg) { console.error('uso: extraer-css.mjs <origen.css> <clases,coma>'); process.exit(2); }
const clases = clasesArg.split(',').map((c) => c.trim()).filter(Boolean);
const src = fs.readFileSync(origen, 'utf8');

/* Trocea en unidades de primer nivel. Cada unidad = todo lo que hay desde el
   final de la anterior (comentarios y selector incluidos) hasta la llave de
   cierre que equilibra su llave de apertura. */
const unidades = [];
let pos = 0;
while (pos < src.length) {
  const abre = src.indexOf('{', pos);
  if (abre === -1) { unidades.push({ texto: src.slice(pos), suelto: true }); break; }
  let prof = 0, i = abre;
  for (; i < src.length; i++) {
    if (src[i] === '{') prof++;
    else if (src[i] === '}') { prof--; if (prof === 0) break; }
  }
  if (prof !== 0) { console.error('llaves desbalanceadas en', origen); process.exit(1); }
  unidades.push({ texto: src.slice(pos, i + 1), prelude: src.slice(pos, abre) });
  pos = i + 1;
}

// Prueba de ida y vuelta: sin esto no hay garantía de que el troceo sea correcto.
const reconstruido = unidades.map((u) => u.texto).join('');
if (reconstruido !== src) {
  console.error('✗ el parser NO reconstruye el original: abortado.');
  console.error(`  original ${src.length} bytes · reconstruido ${reconstruido.length} bytes`);
  process.exit(1);
}

const usa = (t) => clases.some((c) => t.includes('.' + c));
const conservadas = unidades.filter((u) => !u.suelto && usa(u.texto));

process.stdout.write(conservadas.map((u) => u.texto.trim()).join('\n\n') + '\n');
process.stderr.write(`✓ ida y vuelta OK · ${unidades.length} unidades · ${conservadas.length} conservadas\n`);
