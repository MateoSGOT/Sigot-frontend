#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Los datos de maqueta NO pueden llegar al bundle de produccion.

   EL FALLO QUE DETECTA
   datosMaqueta.js existe para rellenar las vistas mientras se revisa el
   maquetado sin sesion, y su cabecera promete que la rama se elimina por
   dead-code elimination. La promesa no se cumplia sola: MAQUETA_ACTIVA se
   importaba desde ese modulo, y aunque Vite reemplaza import.meta.env.DEV por
   `false` DENTRO de datosMaqueta.js, no propaga el valor ya plegado a traves
   del limite del import. El `if (MAQUETA_ACTIVA)` de cada pagina nunca se
   declaraba muerto, las constantes seguian referenciadas y dist/ incluia un
   chunk de 3,9 KB con nombres de clientes, placas y precios inventados.

   La correccion es que cada pagina evalue la puerta en su propio archivo, donde
   las dos lecturas de import.meta.env si se sustituyen por literales.

   Esta auditoria comprueba el RESULTADO, no la forma de escribirlo: busca en
   dist/ el marcador unico y varios literales de los datos. Si alguien vuelve a
   importar la puerta, o agrega un consumidor nuevo que la importe, el chunk
   reaparece y esto falla.

   Requiere un build previo.

   Uso:    npm run build && node scripts/auditar-maqueta.mjs
   Salida: codigo 1 si hay rastro de maqueta en dist/.
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

if (!fs.existsSync('dist')) {
  console.error('no hay dist/. Corre `npm run build` antes.');
  process.exit(2);
}

/* El marcador es la senal principal. Los literales son el respaldo: si alguien
   quita el marcador pero deja los datos, igual se detecta. */
const MARCADOR = 'SIGOT_MAQUETA_LOCAL_NO_PRODUCCION';
const LITERALES = ['Daniela Restrepo', 'Importadora Andina', 'Bujia iridio', 'MTX-412'];

const hallazgos = [];
(function rec(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { rec(f); continue; }
    if (!/\.(js|css|html)$/.test(e.name)) continue;
    const txt = fs.readFileSync(f, 'utf8');
    if (txt.includes(MARCADOR)) hallazgos.push({ f, que: 'marcador ' + MARCADOR });
    for (const lit of LITERALES) {
      if (txt.includes(lit)) hallazgos.push({ f, que: 'dato inventado "' + lit + '"' });
    }
    if (/datosMaqueta/.test(e.name)) hallazgos.push({ f, que: 'chunk del modulo de maqueta' });
  }
})('dist');

if (!hallazgos.length) {
  console.log('datos de maqueta: sin rastro en dist/');
  process.exit(0);
}

console.log('');
console.log(hallazgos.length + ' rastro(s) de maqueta en el bundle de produccion:');
console.log('    (la puerta tiene que evaluarse en el archivo que la usa, no importarse)');
console.log('');
for (const h of hallazgos) console.log('  ' + h.f + '  ->  ' + h.que);
process.exit(1);
