#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Genera (y verifica) el bloque @theme de Tailwind v4 desde variables.css.

   EL PROBLEMA QUE RESUELVE
   Tailwind v4 se configura en CSS: las utilidades salen de los tokens
   declarados en @theme. Pero variables.css ya es la fuente de verdad de 45
   hojas escritas a mano y de ~25 páginas. Si se copian los valores a @theme a
   mano, hay dos listas de literales que se separan en la primera edición -- el
   mismo problema que ya tuvimos con los cuatro rojos y con render.yaml.

   Acá los valores se DERIVAN de variables.css. El archivo generado no se edita:
   se regenera. Y `--check` falla si el generado quedó desincronizado, así que la
   deriva se detecta en CI en vez de en la pantalla.

   POR QUÉ NO AL REVÉS (que @theme sea la única fuente): es posible con
   theme(static), pero si el orden de importación falla, TODAS las páginas
   pierden TODOS los colores a la vez. A días del piloto y sin verificación
   visual, se prefiere duplicación comprobada a un punto único de fallo.

   Uso:  node scripts/generar-theme.mjs            escribe el archivo
         node scripts/generar-theme.mjs --check    exit 1 si hay deriva
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';

const ORIGEN = 'src/shared/styles/variables.css';
const DESTINO = 'src/shared/styles/tailwind-theme.css';
const CHECK = process.argv.includes('--check');

/* Namespaces de Tailwind v4 que coinciden con los nombres que ya usa el
   proyecto: --color-* genera bg-/text-/border-, --radius-* genera rounded-*,
   --shadow-* shadow-*, --font-* font-*, --text-* el tamaño de fuente,
   --tracking-* tracking-*, --leading-* leading-*, --ease-* ease-*. */
const NAMESPACES = ['--color-', '--radius-', '--shadow-', '--font-', '--text-',
                    '--tracking-', '--leading-', '--ease-'];

/* Excluidos a mano, con motivo. Un token cuyo valor no es del tipo que el
   namespace espera genera una utilidad con un valor inválido. */
const EXCLUIDOS = {
  '--color-primary-rgb': 'son tres componentes sueltos ("43, 92, 255"), no un color',
  '--color-focus-ring':  'es una sombra de foco, se aplica con ring-* no con bg-*',
};

const css = fs.readFileSync(ORIGEN, 'utf8');
// Solo el :root base. El bloque @supports de color-mix redefine algunos tokens;
// esos valores ya los hereda el navegador en runtime, y meterlos acá duplicaría
// la declaración dentro de @theme.
const root = css.slice(css.indexOf(':root'), css.indexOf('@supports'));

const tokens = [];
const saltados = [];
for (const m of root.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
  const [, nombre, valor] = [m[0], m[1], m[2].trim()];
  if (!NAMESPACES.some((ns) => nombre.startsWith(ns))) { saltados.push(nombre); continue; }
  if (EXCLUIDOS[nombre]) { saltados.push(nombre); continue; }
  // Un valor multilínea (degradados) no pertenece a estos namespaces.
  if (valor.includes('\n')) { saltados.push(nombre); continue; }
  tokens.push({ nombre, valor });
}

/* Alias de espaciado: el proyecto usa --space-*, Tailwind espera --spacing-*
   para generar p-/m-/gap-. Se declara el alias apuntando al token original, así
   el valor sigue viviendo en un solo sitio. */
const espacios = [...root.matchAll(/(--space-[a-z0-9]+)\s*:\s*([^;]+);/g)]
  .map((m) => ({ nombre: m[1].replace('--space-', '--spacing-'), ref: m[1] }));

const salida = `/* ═══════════════════════════════════════════════════════════════════════════
   GENERADO POR scripts/generar-theme.mjs — NO EDITAR A MANO.

   Expone los tokens de variables.css como tema de Tailwind v4, de modo que las
   utilidades emitan EXACTAMENTE los mismos valores que el CSS escrito a mano.
   Eso es lo que permite migrar de a una página: una vista en Tailwind y una sin
   migrar se ven idénticas porque resuelven al mismo token.

   Para cambiar un valor: editar variables.css y volver a correr
     node scripts/generar-theme.mjs
   Para comprobar que no hay deriva:
     npm run auditar:theme
   ═══════════════════════════════════════════════════════════════════════════ */
@theme {
${tokens.map((t) => `  ${t.nombre}: ${t.valor};`).join('\n')}

  /* Espaciado: el proyecto usa --space-*, Tailwind necesita --spacing-* para
     generar p-/m-/gap-. Alias, para que el valor siga en un solo sitio. */
${espacios.map((e) => `  ${e.nombre}: var(${e.ref});`).join('\n')}
}
`;

if (CHECK) {
  const actual = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, 'utf8') : '';
  if (actual !== salida) {
    console.error('✗ tailwind-theme.css esta desincronizado de variables.css.');
    console.error('  Corre: node scripts/generar-theme.mjs');
    process.exit(1);
  }
  console.log(`✓ tema sincronizado · ${tokens.length} tokens + ${espacios.length} alias de espaciado`);
  process.exit(0);
}

fs.writeFileSync(DESTINO, salida);
console.log(`escrito ${DESTINO}`);
console.log(`  ${tokens.length} tokens expuestos como utilidades`);
console.log(`  ${espacios.length} alias de espaciado`);
console.log(`  ${saltados.length} tokens NO expuestos (no corresponden a un namespace de Tailwind)`);
for (const [n, motivo] of Object.entries(EXCLUIDOS)) console.log(`      excluido ${n}: ${motivo}`);
