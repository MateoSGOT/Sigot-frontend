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

/* MARCAS DE TERCEROS. Una entrada aqui es una decision tomada, no un descuido.

   Los colores de una marca ajena NO pueden tokenizarse ni ajustarse al sistema:
   sus directrices exigen reproducirlos exactos. Meterlos en variables.css seria
   peor que la excepcion -- quedarian expuestos como utilidades de SIGOT
   (bg-google-azul) y alguien acabaria usandolos para algo que no es la marca.

   Si se agrega otra marca, se documenta aqui con su motivo. */
const MARCAS_TERCEROS = new Map([
  ['#4285f4', 'Google · azul de marca (logo "G" del boton de acceso)'],
  ['#34a853', 'Google · verde de marca'],
  ['#fbbc05', 'Google · amarillo de marca'],
  ['#ea4335', 'Google · rojo de marca'],
  ['#1f1f1f', 'Google · color de texto que fija su guia para el boton claro'],
]);

const paleta = fs.readFileSync(PALETA, 'utf8');

// Todo hex que aparezca en variables.css es, por definición, del sistema.
// Se toman TODOS los del archivo (no uno por declaración): varios tokens
// declaran degradados con varias paradas y esas paradas también son paleta.
const delSistema = new Set(
  [...paleta.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0].toLowerCase()),
);

/* ── Tripletas rgb/rgba ──
   PUNTO CIEGO QUE ESTO CORRIGE: antes solo se inspeccionaban hex, así que un
   color escrito como rgba(45,106,45,0.3) era invisible para la auditoría. Por
   esa rendija sobrevivieron a la migración de identidad anterior el verde del
   ToggleSwitch encendido, el del filtro activo y el anillo de foco de page.css,
   más un lima de fondo con texto esmeralda. El informe decía "cero" y era
   cierto: no había hex fuera del sistema. Había rgba.

   Un rgba es legítimo cuando necesita canal alfa (un token hex no lo tiene),
   así que no se puede prohibir: lo que se exige es que sus TRES componentes
   pertenezcan a la paleta. */
const aRgb = (hex) => {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (h.length !== 6) return null;   // 4/8 dígitos (con alfa) se ignoran
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
};

const tripletasDelSistema = new Set([
  // Derivadas de cada hex de la paleta.
  ...[...delSistema].map(aRgb).filter(Boolean),
  // Las que la paleta ya declara como rgb/rgba.
  ...[...paleta.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)]
    .map((m) => `${m[1]},${m[2]},${m[3]}`),
  // Absolutos: blanco y negro se usan tal cual a propósito (texto sobre
  // sólidos, sombras, velos de overlay).
  '255,255,255', '0,0,0',
]);

const hallazgos = [];
const marcas = new Set();

function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { recorrer(f); continue; }
    if (!/\.(css|jsx)$/.test(e.name)) continue;
    if (e.name === 'variables.css') continue;   // es la paleta: su sitio natural

    const rel = f.split(path.sep).join('/');
    const lineas = fs.readFileSync(f, 'utf8').split('\n');

    /* Estado de comentario de bloque. Antes solo se saltaban las líneas que
       EMPIEZAN con /* o * o //, así que una línea de prosa en medio de un
       comentario multilínea se auditaba como si fuera código. Eso daba falsos
       positivos justo en los comentarios que explican por qué un color viejo
       era un problema -- citar el hex en la explicación disparaba el hallazgo. */
    let enBloque = false;

    lineas.forEach((linea, i) => {
      const abre  = linea.lastIndexOf('/*');
      const cierra = linea.lastIndexOf('*/');
      const estabaEnBloque = enBloque;
      if (!enBloque && abre !== -1 && cierra < abre) enBloque = true;
      else if (enBloque && cierra !== -1 && cierra > abre) enBloque = false;

      // Los comentarios no pintan nada.
      if (estabaEnBloque) return;
      if (/^\s*(\/\*|\*|\/\/)/.test(linea)) return;
      for (const m of linea.matchAll(/#[0-9a-fA-F]{3,8}/g)) {
        const c = m[0].toLowerCase();
        if (c.length === 9 || c.length === 5) continue;   // con canal alfa
        if (ABSOLUTOS.has(c)) continue;
        if (MARCAS_TERCEROS.has(c)) { marcas.add(c); continue; }
        if (delSistema.has(c)) continue;
        hallazgos.push({ rel, l: i + 1, c, txt: linea.trim().slice(0, 70) });
      }
      for (const m of linea.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
        const t = `${m[1]},${m[2]},${m[3]}`;
        if (tripletasDelSistema.has(t)) continue;
        hallazgos.push({ rel, l: i + 1, c: `rgb(${t})`, txt: linea.trim().slice(0, 70) });
      }
      /* TERCER PUNTO CIEGO: colores dentro de un data URI. En un SVG embebido el
         `#` va codificado como `%23`, así que ni la búsqueda de hex ni la de
         tripletas los veía. Por esa rendija sobrevivió el verde #2d6a2d en la
         flecha del .filter-select: el hover de TODOS los selectores de filtro se
         ponía verde en una app cobalto, y las dos auditorías decían "cero". */
      for (const m of linea.matchAll(/%23([0-9a-fA-F]{3,6})/g)) {
        const c = `#${m[1].toLowerCase()}`;
        if (ABSOLUTOS.has(c)) continue;
        if (MARCAS_TERCEROS.has(c)) { marcas.add(c); continue; }
        if (delSistema.has(c)) continue;
        hallazgos.push({ rel, l: i + 1, c: `${c} (en data URI)`, txt: linea.trim().slice(0, 70) });
      }
    });
  }
}

recorrer(RAIZ);

console.log(`paleta: ${delSistema.size} valores definidos en ${PALETA}`);

if (hallazgos.length === 0) {
  if (marcas.size) {
    console.log('');
    console.log(`· ${marcas.size} color(es) de marca ajena, admitidos a proposito:`);
    for (const c of [...marcas].sort()) console.log(`    ${c} — ${MARCAS_TERCEROS.get(c)}`);
    console.log('');
  }
  console.log('✓ cero colores fuera del sistema de tokens');
  process.exit(0);
}

console.log(`\n✗ ${hallazgos.length} colores fuera del sistema:\n`);
for (const h of hallazgos) {
  console.log(`  ${h.rel}:${h.l}  ${h.c}`);
  console.log(`      ${h.txt}`);
}
process.exit(1);
