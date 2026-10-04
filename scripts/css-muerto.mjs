#!/usr/bin/env node
/* Clases definidas en un CSS que ningún JSX del proyecto referencia.
   Uso: node scripts/css-muerto.mjs <ruta-al-css> */
import fs from 'fs';
import path from 'path';

const cssPath = process.argv[2];
if (!cssPath) { console.error('falta la ruta del CSS'); process.exit(2); }

const css = fs.readFileSync(cssPath, 'utf8');
// Clases declaradas, ignorando lo que esté dentro de comentarios.
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
const clases = [...new Set([...sinComentarios.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]))];

// Todo el JSX/JS del proyecto (una clase puede usarse desde otro archivo).
let fuente = '';
(function rec(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { rec(f); continue; }
    if (/\.(jsx|js)$/.test(e.name)) fuente += fs.readFileSync(f, 'utf8');
  }
})('src');

const muertas = clases.filter((c) => !fuente.includes(c));

console.log(`${cssPath}: ${clases.length} clases declaradas`);
if (!muertas.length) { console.log('✓ todas tienen consumidor'); process.exit(0); }
console.log(`\n${muertas.length} sin consumidor en ningún JSX:`);
for (const c of muertas) console.log(`  .${c}`);
