#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Migración de identidad: marino+cobalto  ->  negro pulido+cobalto eléctrico.

   Reemplaza los colores de la identidad ANTERIOR que quedaron hardcodeados.
   Dos reglas distintas según el destino:

     .css  -> se sustituye por var(--token) cuando existe un token para ese
              valor. Dejar un hex nuevo hardcodeado solo mueve el problema:
              la próxima vez que cambie la paleta hay que volver a cazarlo.
     .jsx  -> se sustituye por el HEX nuevo. Recharts y los estilos en línea
              reciben valores JS, no clases, así que no pueden usar var().

   Lo que no esté en el mapa NO se toca: se reporta al final. Adivinar un
   equivalente es cómo se colaron las dos fugas de la migración anterior.

   Uso:  node scripts/migrar-identidad.mjs [--aplicar]
         sin --aplicar solo muestra qué haría.
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const APLICAR = process.argv.includes('--aplicar');

// viejo -> { token: nombre para CSS, hex: valor para JSX }
const MAPA = {
  // Cobalto
  '#2563eb': { token: '--color-primary',       hex: '#2B5CFF' },
  '#1d4ed8': { token: '--color-primary-strong', hex: '#1E40D8' },
  '#3b82f6': { token: '--color-primary-500',   hex: '#2B5CFF' },
  '#60a5fa': { token: '--color-primary-light', hex: '#6D8CFF' },
  '#93c5fd': { token: '--color-primary-pale-3', hex: '#94AAFF' },
  '#bfdbfe': { token: '--color-primary-pale-2', hex: '#BFCCFF' },
  '#dbeafe': { token: '--color-primary-pale',  hex: '#DDE4FF' },
  '#eaf1fe': { token: '--color-primary-wash',  hex: '#EEF2FF' },
  '#1e3a8a': { token: '--color-primary-900',   hex: '#162D96' },
  '#1e40af': { token: '--color-primary-800',   hex: '#1A36B8' },
  // Estructura: marino -> negro pulido
  '#0b1220': { token: '--sidebar-bg',          hex: '#0A0A0B' },
  '#0e1627': { token: '--sidebar-bg',          hex: '#101013' },
  '#16233a': { token: '--sidebar-bg-raised',   hex: '#181A22' },
  '#131c2e': { token: '--sidebar-bg-raised',   hex: '#16161A' },
  '#0e1a2c': { token: '--sidebar-bg',          hex: '#0A0A0B' },
  // Canvas y superficies
  '#f6f7f9': { token: '--color-bg',            hex: '#F8FAFC' },
  '#f1f3f6': { token: '--color-surface-raised', hex: '#F1F5F9' },
  '#fbfcfd': { token: '--color-surface-solid', hex: '#FCFDFE' },
  '#e2e8f0': { token: '--color-track-light',   hex: '#E2E8F0' },
};

/* Tripletas rgb/rgba. Van aparte porque un rgba() lleva canal alfa que hay que
   PRESERVAR: no se puede sustituir por var(--token) (el token es un color
   completo, no tres componentes), así que acá se reemplazan los tres números y
   el alfa queda intacto.

   Esta es la fuga que la auditoría de paleta no veía: solo inspeccionaba hex.
   Varios de estos son de la identidad VERDE anterior y sobrevivieron a la
   migración pasada justamente por eso. */
const TRIPLETAS = {
  // Identidad verde anterior -> cobalto. Son estados de ACCIÓN/ACTIVO
  // (ToggleSwitch encendido, filtro aplicado, anillo de foco de page.css),
  // y en este sistema la acción es el acento.
  '45,106,45':    { a: '43, 92, 255',  nota: 'verde de acción (identidad vieja) -> cobalto' },
  // Lima de fondo con texto esmeralda: familias cruzadas en .role-icon--success.
  '101,163,13':   { a: '5, 150, 105',  nota: 'lima -> esmeralda, para igualar su propio texto' },
  // Azul viejo del badge "En proceso": el texto ya migró, el fondo y el borde no.
  '78,154,241':   { a: '43, 92, 255',  nota: 'azul viejo -> cobalto' },
  // Rampa de cobalto anterior
  '37,99,235':    { a: '43, 92, 255',  nota: '#2563EB -> cobalto eléctrico' },
  '96,165,250':   { a: '109, 140, 255', nota: '#60A5FA -> primary-light nuevo' },
  '29,78,216':    { a: '30, 64, 216',  nota: '#1D4ED8 -> primary-strong nuevo' },
  '30,58,138':    { a: '22, 45, 150',  nota: '#1E3A8A -> primary-900 nuevo' },
  // Estructura: marino y grises azulados -> negro pulido
  '11,18,32':     { a: '10, 10, 11',   nota: 'marino del sidebar -> negro' },
  '16,24,40':     { a: '10, 10, 11',   nota: 'tinte de sombra marino -> negro' },
  '14,22,39':     { a: '10, 10, 11',   nota: 'marino medio -> negro' },
  '19,28,46':     { a: '22, 22, 26',   nota: 'marino elevado -> negro elevado' },
  '17,24,39':     { a: '10, 10, 11',   nota: 'gray-900 -> negro del sistema' },
  '15,23,42':     { a: '10, 10, 11',   nota: 'slate-900 -> negro del sistema' },
  '20,22,32':     { a: '22, 22, 26',   nota: 'oscuro azulado -> negro elevado' },
  '233,237,243':  { a: '237, 237, 239', nota: 'texto sobre oscuro, sin tinte azul' },

  /* ── Unificación de los rojos y los ámbares ──
     La app tenía CUATRO rojos distintos conviviendo (#DC2626, #EF4444,
     #F14E4E y el del sistema #E11D48) y TRES ámbares (#F5A623, #D97706 y el
     del sistema #F59E0B). Ninguno estaba mal escrito: simplemente nunca se
     unificaron, y la auditoría no los veía porque estaban en rgba.

     El efecto era que el rojo del botón "Anular", el del error del formulario
     y el del banner del dashboard no eran el mismo rojo, así que "error" no
     tenía un color: tenía cuatro parecidos. Todos pasan al par del sistema. */
  '220,38,38':   { a: '225, 29, 72',   nota: 'red-600 -> rojo del sistema' },
  '239,68,68':   { a: '225, 29, 72',   nota: 'red-500 -> rojo del sistema' },
  '241,78,78':   { a: '225, 29, 72',   nota: 'rojo suelto -> rojo del sistema' },
  '245,166,35':  { a: '245, 158, 11',  nota: 'ámbar suelto -> ámbar del sistema' },
  '217,119,6':   { a: '245, 158, 11',  nota: 'amber-600 -> ámbar del sistema' },
};

const RAIZ = 'src';
const cambios = [];
const sinMapear = [];

// Hex que son del sistema NUEVO o absolutos: no se tocan.
const ACEPTADOS = new Set(
  [...fs.readFileSync('src/shared/styles/variables.css', 'utf8')
    .matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0].toLowerCase())
    .concat(['#fff', '#ffffff', '#000', '#000000']),
);

function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { recorrer(f); continue; }
    if (!/\.(css|jsx)$/.test(e.name)) continue;
    if (e.name === 'variables.css') continue;

    const rel = f.split(path.sep).join('/');
    const esCss = e.name.endsWith('.css');
    let texto = fs.readFileSync(f, 'utf8');
    let tocado = false;

    texto = texto.replace(/#[0-9a-fA-F]{3,8}/g, (hex) => {
      const k = hex.toLowerCase();
      if (k.length === 9 || k.length === 5) return hex;   // con canal alfa
      const m = MAPA[k];
      if (!m) {
        if (!ACEPTADOS.has(k)) sinMapear.push({ rel, hex });
        return hex;
      }
      tocado = true;
      const nuevo = esCss ? `var(${m.token})` : m.hex;
      cambios.push({ rel, de: hex, a: nuevo });
      return nuevo;
    });

    // Tripletas rgb/rgba: se reemplazan los tres componentes y se conserva todo
    // lo que venga después (el alfa, si lo hay).
    texto = texto.replace(/(rgba?\(\s*)(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g,
      (todo, abre, r, g, b) => {
        const clave = `${r},${g},${b}`;
        const m = TRIPLETAS[clave];
        if (!m) return todo;
        tocado = true;
        cambios.push({ rel, de: `rgb(${clave})`, a: `rgb(${m.a})  — ${m.nota}` });
        return `${abre}${m.a}`;
      });

    if (tocado && APLICAR) fs.writeFileSync(f, texto);
  }
}

recorrer(RAIZ);

const porArchivo = cambios.reduce((a, c) => { (a[c.rel] ??= []).push(c); return a; }, {});
console.log(`${APLICAR ? 'APLICADO' : 'SIMULACIÓN'}: ${cambios.length} reemplazos en ${Object.keys(porArchivo).length} archivos\n`);
for (const [rel, cs] of Object.entries(porArchivo)) {
  const resumen = [...new Set(cs.map((c) => `${c.de}→${c.a}`))];
  console.log(`  ${rel}  (${cs.length})`);
  for (const r of resumen) console.log(`      ${r}`);
}

if (sinMapear.length) {
  const u = [...new Set(sinMapear.map((s) => `${s.rel}  ${s.hex}`))];
  console.log(`\n⚠️  ${u.length} color(es) fuera del sistema y SIN mapeo -- revisar a mano:`);
  for (const s of u) console.log(`      ${s}`);
}
if (!APLICAR) console.log('\n(volver a correr con --aplicar para escribir)');
