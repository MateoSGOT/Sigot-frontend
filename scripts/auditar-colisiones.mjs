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
   Una clase escrita a mano con el mismo NOMBRE que una utilidad generada. La de
   a mano gana (el CSS de pagina no esta estratificado) y la utilidad real nunca
   se aplica. Con el mismo valor no se nota; en cuanto uno de los dos cambia, el
   codigo nuevo recibe el valor viejo sin ningun aviso.

   Paso con .font-medium: el proyecto la definia como font-weight 600 en DOCE
   archivos y la de Tailwind es 500, asi que el codigo que pedia `font-medium`
   esperando 500 recibia 600 y el build pasaba limpio.

   LA LISTA DE NOMBRES ERA A MANO, Y ESO FALLABA. Antes esto comparaba contra un
   regex de nombres de Tailwind escrito por mi. Un regex asi solo encuentra lo
   que ya sabias que buscar: no incluia los colores, asi que no vio las cinco
   clases .text-danger / .text-success / .text-warning / .text-info / .text-muted
   de globals.css, que sombrean utilidades generadas del mismo nombre.

   Ahora la fuente de verdad es el CSS COMPILADO: se leen las clases que Tailwind
   emitio DENTRO de `@layer utilities` en dist/ y se compara contra las escritas a
   mano en src/. Nada de listas que mantener.

   Requiere un build previo. Sin dist/ este chequeo se salta (avisando), para que
   el script siga sirviendo en un arbol recien clonado. */
const utilidadesGeneradas = new Set();
let hayDist = false;
if (fs.existsSync('dist/assets')) {
  const bundle = fs.readdirSync('dist/assets').filter((n) => n.endsWith('.css'))
    .map((n) => fs.readFileSync(path.join('dist/assets', n), 'utf8')).join('');
  // Recorta el contenido de cada bloque @layer utilities{...} contando llaves.
  let i = bundle.indexOf('@layer utilities');
  while (i !== -1) {
    const abre = bundle.indexOf('{', i);
    if (abre === -1) break;
    let d = 1, j = abre + 1;
    while (j < bundle.length && d > 0) { if (bundle[j] === '{') d++; else if (bundle[j] === '}') d--; j++; }
    const dentro = bundle.slice(abre + 1, j - 1);
    /* Solo la clase que ENCABEZA el selector es el nombre de la utilidad.
       Tailwind emite variantes arbitrarias como
         .\[\&_\.btn\]\:shrink-0 .btn{flex-shrink:0}
       donde `.btn` es el OBJETIVO del descendiente, no una utilidad generada.
       Capturarla hacia que .btn, .card, .form-control, .ss, .table-wrapper y
       .form-error salieran como sombreados cuando no lo son. En CSS minificado
       un selector arranca justo despues de } o de , ; precedido de un espacio es
       siempre un descendiente. */
    for (const m of dentro.matchAll(/[},\n]\s*\.((?:[\w-]|\\.)+)/g)) {
      utilidadesGeneradas.add(m[1].replace(/\\(.)/g, '$1'));
      hayDist = true;
    }
    i = bundle.indexOf('@layer utilities', j);
  }
}

/* Excepciones documentadas. Una entrada aca es una decision tomada, no un
   descuido: el sombreado existe y se acepta por la razon que se anota. */
const SOMBRA_ACEPTADA = {
  '.table': 'Es el nombre estructural de la tabla del proyecto (Table.jsx/Table.css), '
          + 'anterior a Tailwind y usado por todas las paginas. Tailwind genera .table '
          + 'solo porque ese mismo nombre aparece como candidato en el codigo, y lo unico '
          + 'que declara es display:table -- propiedad que Table.css no toca y que un '
          + '<table> ya tiene por defecto, asi que no hay diferencia en pantalla. '
          + 'Renombrarlo tocaria todas las vistas sin ganar nada.',
};

const sombreados = [];
const aceptados = [];
if (hayDist) {
  for (const [sel, lista] of mapa) {
    if (!/^\.[\w-]+$/.test(sel)) continue;           // solo clases simples
    const nombre = sel.slice(1);
    if (!utilidadesGeneradas.has(nombre)) continue;
    if (SOMBRA_ACEPTADA[sel]) { aceptados.push(sel); continue; }
    sombreados.push({ sel, lista });
  }
}

/* ── SELECTORES DE ELEMENTO SIN ESTRATIFICAR ──
   La tercera cara del mismo problema, y la más silenciosa de las tres.

   El orden de capas se evalúa ANTES que la especificidad, y el CSS sin capa
   gana sobre CUALQUIER capa. O sea: un `a { color: inherit }` suelto vence a
   `.text-white\/45` de la capa `utilities`, aunque la clase tenga más
   especificidad y aunque se escriba después.

   No lo detectan los otros dos chequeos: el selector aparece en UN solo archivo
   (no es colisión) y no se llama como una utilidad (no es sombreado). Sólo se
   ve mirando el color computado en el navegador.

   Ya mordió dos veces:
     *, *::before, *::after { margin: 0; padding: 0 }  anulaba TODO el espaciado
       de Tailwind -- cuatro commits con m-/p-/gap- sin efecto en login, portal,
       modal de órdenes y landing.
     a { color: inherit }  dejaba el enlace "Volver al login" de /reset-password
       en tinta casi negra sobre tarjeta casi negra, pidiendo text-white/45.

   La corrección siempre es la misma: envolver en @layer base. Ahí siguen
   normalizando el elemento, pero ceden ante lo que una vista pide explícitamente.

   Se ignoran los selectores que son sólo pseudo-elementos (::-webkit-scrollbar y
   compañía): Tailwind no genera utilidades que compitan con ellos. */
const PROPS_TAILWIND = /^(color|background|background-color|margin|padding|border|border-[a-z-]+|font|font-[a-z-]+|line-height|letter-spacing|text-[a-z-]+|display|opacity|width|height|max-width|max-height|min-width|min-height|gap|box-shadow|border-radius|cursor|overflow|position|inset|top|right|bottom|left|z-index)$/;

const sinCapa = [];
for (const f of archivos) {
  const css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Recorre llevando la pila de at-rules abiertas, para saber si una regla está
  // dentro de un @layer o no. Un parser de llaves basta: no hay strings con
  // llaves sueltas en estas hojas.
  const pila = [];
  let i = 0, prelucio = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '{') {
      const prelude = css.slice(prelucio, i).trim().replace(/\s+/g, ' ');
      if (prelude.startsWith('@')) { pila.push(prelude); i++; prelucio = i; continue; }
      // Es una regla normal: buscar su cierre.
      let d = 1, j = i + 1;
      while (j < css.length && d > 0) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
      const cuerpo = css.slice(i + 1, j - 1);
      const enCapa = pila.some((a) => a.startsWith('@layer'));
      // `from`/`to`/`50%` dentro de @keyframes parecen selectores de elemento
      // pero son pasos de la animacion; no compiten con ninguna utilidad.
      const enKeyframes = /^@(-[a-z]+-)?keyframes/.test(pila[pila.length - 1] || '');
      // Selector de ELEMENTO puro: sin . # [ ni :pseudo-clase, y con al menos un
      // nombre de etiqueta (o el universal).
      const partes = prelude.split(',').map((x) => x.trim());
      const esElemento = partes.length > 0 && partes.every(
        (x) => x && !/[.#[]/.test(x) && !/:(?!:)/.test(x) && /^[a-z*]/i.test(x));
      const soloPseudoElem = partes.every((x) => x.includes('::'));
      if (!enCapa && !enKeyframes && esElemento && !soloPseudoElem && !/^:root/.test(prelude)) {
        const props = [...cuerpo.matchAll(/([a-z-]+)\s*:/gi)]
          .map((m) => m[1].toLowerCase()).filter((n) => PROPS_TAILWIND.test(n));
        if (props.length) sinCapa.push({ f, sel: prelude, props: [...new Set(props)] });
      }
      i = j; prelucio = i; continue;
    }
    if (c === '}') { pila.pop(); i++; prelucio = i; continue; }
    if (c === ';' && pila.length === 0) { i++; prelucio = i; continue; }
    i++;
  }
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

if (aceptados.length) {
  console.log('');
  console.log(`· ${aceptados.length} sombreado(s) aceptado(s) a proposito:`);
  for (const sel of aceptados) console.log(`    ${sel} — ${SOMBRA_ACEPTADA[sel]}`);
}

if (sinCapa.length) {
  console.log('');
  console.log(`✗ ${sinCapa.length} regla(s) de elemento FUERA de @layer`);
  console.log('    (el CSS sin capa le gana a toda la capa utilities: las clases de');
  console.log('     Tailwind sobre ese elemento no se aplican nunca.');
  console.log('     Solucion: envolver la regla en @layer base)');
  console.log('');
  for (const x of sinCapa) {
    console.log(`  ${x.sel}   →   ${x.props.join(', ')}`);
    console.log(`      ${x.f}`);
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
  if (!sombreados.length && !sinCapa.length) {
    console.log('');
    console.log('✓ sin colisiones entre hojas, sin sombreado de utilidades y sin reglas de elemento fuera de capa');
  }
  // El sombreado también hace fallar el audit: una clase a mano con el nombre
  // de una utilidad es un bug latente aunque hoy tenga el mismo valor.
  process.exit(sombreados.length || sinCapa.length ? 1 : 0);
}

console.log(`\n✗ ${distintos.length} selector(es) con valores DISTINTOS en dos hojas -- gana el orden de carga:\n`);
for (const { sel, lista } of distintos) {
  console.log(`  ${sel}`);
  for (const x of lista) console.log(`      ${x.archivo}\n          ${x.cuerpo.slice(0, 110)}`);
}
process.exit(1);
