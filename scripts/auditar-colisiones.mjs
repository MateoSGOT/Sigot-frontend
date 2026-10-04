#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Selectores declarados en MÁS DE UN archivo CSS, con valores distintos.

   POR QUÉ IMPORTA: el CSS de este proyecto es global -- no hay módulos ni
   scoping. Si dos hojas declaran el mismo selector, gana la que cargue después,
   y como las páginas se cargan por code-splitting el orden depende de por dónde
   entró el usuario. Resultado: la misma pantalla se ve distinta según la ruta
   de navegación, y eso no se reproduce mirando una sola pantalla.

   Pasó de verdad: PortalPage.css tenía 16 selectores del detalle de orden
   copiados de OrdenesPage.css (su propio comentario decía "copied from
   OrdenesPage.css") y los 16 habían divergido. Se extrajeron a
   shared/styles/orden-detalle.css.

   Una colisión con valores IDÉNTICOS se reporta aparte: no cambia nada visual,
   pero sigue siendo duplicación que se va a separar en cuanto alguien edite una
   de las dos copias.

   Uso:    node scripts/auditar-colisiones.mjs
   Salida: código 1 si hay colisiones con valores distintos.
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const archivos = [];
(function rec(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { rec(f); continue; }
    if (e.name.endsWith('.css')) archivos.push(f.split(path.sep).join('/'));
  }
})('src');

// selector -> [{ archivo, cuerpo }]
const mapa = new Map();

for (const f of archivos) {
  // Fuera comentarios y bloques @ (media/container/supports/keyframes): un mismo
  // selector dentro de dos @media distintos NO es una colisión.
  let css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  css = css.replace(/@[a-z-]+[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/gi, '');

  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (!sel || sel.startsWith('@') || sel.startsWith(':root')) continue;
    const cuerpo = m[2].replace(/\s+/g, ' ').trim();
    if (!mapa.has(sel)) mapa.set(sel, []);
    const lista = mapa.get(sel);
    if (!lista.some((x) => x.archivo === f)) lista.push({ archivo: f, cuerpo });
  }
}

/* ── SOMBREADO DE UTILIDADES DE TAILWIND ──
   Riesgo que apareció al entrar Tailwind: una clase escrita a mano con el mismo
   NOMBRE que una utilidad. Como el CSS del proyecto no está estratificado y las
   utilidades viven en la capa `utilities`, la de a mano gana siempre.

   Con el mismo valor no se nota. Pasó con .font-medium: el proyecto la definía
   como font-weight 600 en DOCE archivos y la de Tailwind es 500, así que el
   código nuevo que pedía `font-medium` esperando 500 recibía 600 -- y el build
   pasaba limpio. */
const NOMBRES_TAILWIND = /^\.(font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|truncate|hidden|block|inline|flex|grid|contents|flex-(row|col|wrap|nowrap)|items-(start|center|end|baseline|stretch)|justify-(start|center|end|between|around|evenly)|gap-\d+|[wh]-(full|screen|auto)|text-(left|right|center|justify)|rounded(-(none|sm|md|lg|xl|full))?|border|shadow(-(sm|md|lg|xl|none))?|relative|absolute|fixed|sticky|static|uppercase|lowercase|capitalize|underline|italic)$/;

const sombreados = [];
for (const [sel, lista] of mapa) {
  if (!NOMBRES_TAILWIND.test(sel)) continue;
  sombreados.push({ sel, lista });
}

const distintos = [];
const iguales = [];
for (const [sel, lista] of mapa) {
  if (lista.length < 2) continue;
  const unicos = new Set(lista.map((x) => x.cuerpo));
  (unicos.size > 1 ? distintos : iguales).push({ sel, lista });
}

console.log(`${archivos.length} hojas · ${mapa.size} selectores`);

if (sombreados.length) {
  console.log(`\n✗ ${sombreados.length} clase(s) a mano con el NOMBRE de una utilidad de Tailwind`);
  console.log('    (el CSS sin estratificar le gana a la capa utilities: la utilidad real nunca se aplica)\n');
  for (const { sel, lista } of sombreados) {
    console.log(`  ${sel}`);
    for (const x of lista) console.log(`      ${x.archivo}\n          ${x.cuerpo.slice(0, 100)}`);
  }
}

if (iguales.length) {
  console.log(`\n· ${iguales.length} selector(es) duplicados con valores IDÉNTICOS (sin efecto visual, pero duplicados):`);
  for (const { sel, lista } of iguales) {
    console.log(`    ${sel}`);
    for (const x of lista) console.log(`        ${x.archivo}`);
  }
}

if (!distintos.length) {
  if (!sombreados.length) {
    console.log('\n✓ ningún selector con valores distintos ni sombreando utilidades de Tailwind');
  }
  // El sombreado también hace fallar el audit: una clase a mano con el nombre
  // de una utilidad es un bug latente aunque hoy tenga el mismo valor.
  process.exit(sombreados.length ? 1 : 0);
}

console.log(`\n✗ ${distintos.length} selector(es) con valores DISTINTOS en dos hojas -- gana el orden de carga:\n`);
for (const { sel, lista } of distintos) {
  console.log(`  ${sel}`);
  for (const x of lista) console.log(`      ${x.archivo}\n          ${x.cuerpo.slice(0, 110)}`);
}
process.exit(1);
