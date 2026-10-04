import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Se importa como `Motion` (mayúscula): la config de eslint del proyecto exime de
// no-unused-vars solo lo que empieza en mayúscula, y sin eslint-plugin-react la
// regla no reconoce el JSX con miembro (<Motion.div>) como un uso.
import { motion as Motion, AnimatePresence } from 'motion/react';
import {
  MdBuild, MdSearch, MdRotateRight, MdElectricBolt, MdDoNotDisturb, MdInvertColors,
  MdDirectionsCar, MdCheck, MdLocationOn, MdAccessTime, MdPhone, MdEmail,
  MdGroups, MdListAlt, MdMiscellaneousServices, MdClose, MdMenu,
} from 'react-icons/md';
import { FiMessageSquare } from 'react-icons/fi';
import api from '../../../shared/services/api.js';
import { RESORTE, AL_ENTRAR, REVELADO, retardo } from '../../../shared/styles/movimiento.js';

/* ═══════════════════════════════════════════════════════════════════════════
   LANDING — reescrita con Tailwind v4 + Motion.

   SIN CSS PROPIO. LandingPage.css (818 líneas, 117 clases) queda eliminado.
   Todo sale de utilidades que resuelven a los MISMOS tokens que el panel, así
   que el cobalto de un botón de aquí es el cobalto de un botón de allá: no hay
   dos definiciones del azul de marca.

   Antes el archivo declaraba una paleta local --lnd-* que era un alias de los
   tokens globales. Al no haber CSS, ese puente deja de hacer falta.

   EL REVELADO AL SCROLL PASA A MOTION. Había un useInView con
   IntersectionObserver que añadía una clase, más una transición CSS de 0.65s y
   un transitionDelay en línea. Ahora es `whileInView` con el muelle calibrado
   (ver shared/styles/movimiento.js): mismo gesto, un solo sistema de animación
   en toda la app, y sin un observer por sección.

   LO QUE NO CAMBIA: el fetch de /api/landing/stats, el conteo animado de los
   KPIs y el scroll suave entre secciones. Es lógica, no presentación.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Data ─────────────────────────────────────────────────── */
// Métricas reales que expone GET /api/landing/stats (agregados, sin datos
// personales). Cada card se llena con datos del sistema, nada hardcodeado.
const STAT_DEFS = [
  { key: 'vehiculosAtendidos',   label: 'Vehículos atendidos',   Icon: MdDirectionsCar },
  { key: 'clientesActivos',      label: 'Clientes activos',      Icon: MdGroups },
  { key: 'serviciosDisponibles', label: 'Servicios disponibles', Icon: MdMiscellaneousServices },
  { key: 'ordenesTotales',       label: 'Órdenes gestionadas',   Icon: MdListAlt },
];

const SERVICES = [
  { Icon: MdBuild,          title: 'Mantenimiento preventivo', desc: 'Revisión completa de 60 puntos para mantener tu vehículo en óptimas condiciones.' },
  { Icon: MdSearch,         title: 'Diagnóstico computarizado', desc: 'Escáner OBD2 profesional para detectar fallas con precisión milimétrica.' },
  { Icon: MdRotateRight,    title: 'Alineación y balanceo', desc: 'Corregimos la geometría de dirección y balanceo de llantas con tecnología 3D.' },
  { Icon: MdElectricBolt,   title: 'Sistema eléctrico', desc: 'Diagnóstico y reparación de baterías, alternadores, sensores y cableado.' },
  { Icon: MdDoNotDisturb,   title: 'Sistema de frenos', desc: 'Inspección, ajuste y cambio de pastillas, discos y líquido de frenos.' },
  { Icon: MdInvertColors,   title: 'Cambio de aceite y filtros', desc: 'Cambio con aceites certificados y filtros originales para mayor durabilidad del motor.' },
];

// El campo `eje` nombra la DIMENSIÓN de cada promesa (equipo, equipamiento,
// precio, posventa). Antes era un numeral 01–04, pero estas razones son
// paralelas, no una secuencia: numerarlas sugería un orden que no existe.
// La etiqueta, en cambio, le dice al lector de qué le están hablando.
const REASONS = [
  { eje: 'Equipo',       title: 'Técnicos certificados', desc: 'Nuestro equipo cuenta con certificaciones internacionales y experiencia comprobada en todas las marcas.' },
  { eje: 'Equipamiento', title: 'Tecnología de punta', desc: 'Herramientas y escáneres de última generación para diagnósticos precisos y rápidos.' },
  { eje: 'Precio',       title: 'Transparencia total', desc: 'Te mostramos qué se hace y por qué. Sin cobros ocultos, sin sorpresas en el comprobante.' },
  { eje: 'Posventa',     title: 'Garantía real', desc: 'Todos nuestros servicios incluyen garantía por escrito. Tu tranquilidad es nuestra prioridad.' },
];

const SECCIONES = [['servicios', 'Servicios'], ['nosotros', 'Nosotros'], ['ubicacion', 'Ubicación']];

/* ─── Clases repetidas ──────────────────────────────────────
   A constantes y no a @apply: con @apply volverían a ser CSS propio, que es
   justo lo que se está quitando. */
const BTN = 'inline-flex cursor-pointer items-center justify-center gap-sm rounded-md border-0 '
  + 'font-[inherit] font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform] '
  + 'duration-150 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 '
  + 'focus-visible:outline-focus';
const BTN_PRIMARIO = `${BTN} bg-primary px-xl py-md text-body text-primary-on `
  + 'hover:bg-primary-strong hover:shadow-[var(--shadow-green)]';
const BTN_CONTORNO = `${BTN} border-2 border-primary bg-transparent px-xl py-md text-body `
  + 'text-primary-soft-on hover:bg-primary-soft';
const BTN_GRANDE = 'min-h-[var(--touch-min)] px-2xl text-h3';

const SECCION = 'py-[clamp(4rem,9vw,7rem)]';
const CONTENEDOR = 'mx-auto w-full max-w-[1200px] px-lg';
const ETIQUETA_SECCION = 'inline-flex items-center gap-sm rounded-full bg-primary-soft px-lg py-xs '
  + 'text-small font-bold uppercase tracking-wide text-primary-soft-on';
/* Tipografía fluida: interpola con clamp() entre celular y monitor grande en vez
   de saltar en un breakpoint. */
const TITULO_SECCION = 'font-display text-[clamp(1.875rem,4.2vw,2.75rem)] font-extrabold '
  + 'leading-[1.12] tracking-tight text-text text-balance';
const TARJETA = 'h-full rounded-lg border border-border bg-surface p-xl shadow-sm '
  + 'transition-[box-shadow,transform] duration-200 hover:-translate-y-[2px] hover:shadow-md';

/* ─── Conteo animado de KPIs (respeta prefers-reduced-motion) ── */
function useCountUp(target, active, duration = 1300) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number' || Number.isNaN(target)) { setVal(0); return; }
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!active || reduce || target === 0) { setVal(target); return; }
    let raf; const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return val;
}

function CountUp({ value, loading, active = true, suffix = '', anchoSkel = 'w-16' }) {
  const n = useCountUp(loading ? 0 : (value ?? 0), active && !loading);
  // Esqueleto del MISMO alto que la cifra: si fuera más bajo, al llegar el dato
  // la tarjeta crecería y empujaría la sección de abajo.
  if (loading) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block h-[1em] ${anchoSkel} animate-pulse rounded-sm bg-surface-raised align-middle`}
      />
    );
  }
  return <>{n.toLocaleString('es-CO')}{suffix}</>;
}

/* Revelado al entrar en viewport. Reemplaza al IntersectionObserver propio y a
   la transición CSS de 0.65s: un solo sistema de animación para toda la app. */
function Revelar({ children, i = 0, className = '' }) {
  return (
    <Motion.div
      className={className}
      variants={REVELADO}
      initial="oculto"
      whileInView="visible"
      viewport={AL_ENTRAR}
      transition={{ ...RESORTE, ...retardo(i) }}
    >
      {children}
    </Motion.div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsInView, setStatsInView] = useState(false);
  const statsRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* El conteo de los KPIs arranca cuando la fila entra en pantalla. Se conserva
     un observer SOLO para esto: Motion dispara animaciones, pero acá lo que hace
     falta es un booleano que alimente un hook de conteo, no una transición. */
  useEffect(() => {
    const nodo = statsRef.current;
    if (!nodo) return undefined;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setStatsInView(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(nodo);
    return () => obs.disconnect();
  }, []);

  // Estadísticas públicas reales (agregados). Sin token: es la página pública.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await api.get('/api/landing/stats');
        if (!cancel) setStats(r.data?.data || null);
      } catch { /* silencioso: la landing no debe romperse si el stat falla */ }
      finally { if (!cancel) setStatsLoading(false); }
    })();
    return () => { cancel = true; };
  }, []);

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="overflow-x-hidden bg-surface font-body text-text">
      {/* ── NAVBAR ──────────────────────────────────────────── */}
      <nav
        className={`fixed inset-x-0 top-0 z-[1000] transition-[background-color,box-shadow,backdrop-filter] duration-300
                    ${scrolled || menuOpen
                      ? 'bg-surface/90 shadow-sm backdrop-blur-[20px]'
                      : 'bg-transparent'}`}
      >
        <div className={`${CONTENEDOR} flex h-[68px] items-center gap-xl`}>
          <button
            type="button"
            onClick={() => scrollTo('hero')}
            className="shrink-0 cursor-pointer border-0 bg-transparent p-0
                       font-display text-h1 font-extrabold tracking-[0.16em]
                       bg-gradient-to-r from-[var(--surface-dark)] to-[var(--color-primary)]
                       bg-clip-text text-transparent"
          >
            SIGOT
          </button>

          {/* Enlaces: solo escritorio. En móvil van en la hoja flotante. */}
          <div className="mx-auto hidden items-center gap-xs md:flex">
            {SECCIONES.map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="cursor-pointer rounded-sm border-0 bg-transparent px-lg py-sm
                           font-[inherit] text-body font-medium text-text-muted
                           transition-colors duration-150 hover:bg-primary-soft hover:text-primary-soft-on"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-md md:ml-0">
            <button className={`${BTN_PRIMARIO} max-md:hidden`} onClick={() => navigate('/login')}>
              Ingresar al sistema
            </button>
            {/* Mínimo táctil del sistema: se opera con el pulgar. */}
            <button
              type="button"
              onClick={() => setMenuOpen(p => !p)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="flex size-[var(--touch-min)] cursor-pointer items-center justify-center
                         rounded-md border border-border bg-surface text-text
                         transition-colors duration-150 hover:bg-surface-raised md:hidden"
            >
              {menuOpen ? <MdClose size={22} /> : <MdMenu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Menú móvil: hoja flotante, no una barra inferior fija.
          Una barra fija al pie compite con los CTA de la propia página y es un
          patrón de chrome de aplicación, no de página comercial. La hoja entra
          con el mismo muelle que el resto de la app y deja el CTA principal
          dentro, que es a donde se quiere llevar al visitante. */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <Motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-[999] bg-[rgb(10_10_11_/_0.4)] backdrop-blur-[2px] md:hidden"
              aria-hidden="true"
            />
            <Motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={RESORTE}
              className="fixed inset-x-lg top-[76px] z-[1001] flex flex-col gap-xs rounded-lg
                         border border-border bg-surface p-md shadow-lg md:hidden"
            >
              {SECCIONES.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="min-h-[var(--touch-min)] cursor-pointer rounded-md border-0 bg-transparent
                             px-lg text-left font-[inherit] text-h3 font-semibold text-text
                             transition-colors duration-150 hover:bg-surface-raised"
                >
                  {label}
                </button>
              ))}
              <button
                className={`${BTN_PRIMARIO} ${BTN_GRANDE} mt-xs w-full`}
                onClick={() => { setMenuOpen(false); navigate('/login'); }}
              >
                Ingresar al sistema
              </button>
            </Motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section
        id="hero"
        className={`${CONTENEDOR} flex min-h-dvh flex-wrap items-center gap-3xl pt-[8rem] pb-3xl`}
      >
        {/* Halos de fondo. Capa fija y aparte para que no se repinten con el
            scroll, y en oklab para que el degradado no cruce por una zona
            apagada a mitad de camino. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -top-[100px] -right-[100px] size-[600px] rounded-full opacity-35
                          blur-[80px] bg-[radial-gradient(circle_in_oklab,var(--color-primary-pale-3),transparent)]" />
          <div className="absolute bottom-[100px] -left-[50px] size-[400px] rounded-full opacity-35
                          blur-[80px] bg-[radial-gradient(circle_in_oklab,var(--color-primary-pale-2),transparent)]" />
        </div>

        <Motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={RESORTE}
          className="min-w-0 flex-[0_0_580px] max-w-[580px] max-lg:flex-[1_1_100%] max-lg:max-w-none"
        >
          {/* Etiqueta de tipo y lugar, no una frase: mono con tracking abierto,
              el mismo tratamiento que los identificadores del resto del sistema. */}
          <p className="mb-lg inline-flex items-center gap-sm rounded-full bg-primary-soft px-lg py-sm
                        font-mono text-caption font-semibold tracking-code text-primary-soft-on">
            Taller especializado · Copacabana, Antioquia
          </p>
          <h1 className="font-display text-hero font-extrabold leading-[1.05] tracking-tighter text-text text-balance">
            Deja tu carro.<br />
            <span className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)]
                             bg-clip-text text-transparent">
              Sigue cada paso.
            </span>
          </h1>
          <p className="mt-lg max-w-[52ch] text-h3 leading-normal text-text-muted">
            Agenda en línea y entra a tu portal para ver en qué va tu orden, qué se le
            hizo al vehículo y cuánto cuesta. Mantenimiento, diagnóstico y reparación
            en Copacabana, Antioquia.
          </p>
          <div className="mt-2xl flex flex-wrap gap-md">
            {/* Agendar es la accion de negocio principal: un cliente nuevo crea cuenta,
                registra su vehiculo y agenda en el mismo flujo (ver AgendarCitaPage). */}
            <button className={`${BTN_PRIMARIO} ${BTN_GRANDE}`} onClick={() => navigate('/agendar')}>
              Agendar una cita
            </button>
            <button className={`${BTN_CONTORNO} ${BTN_GRANDE}`} onClick={() => scrollTo('servicios')}>
              Ver servicios
            </button>
          </div>
        </Motion.div>

        {/* Maqueta del panel: el "hero" no es una foto de stock sino el producto
            real, con las cifras del sistema. */}
        <Motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...RESORTE, delay: 0.08 }}
          className="min-w-[320px] flex-1"
        >
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            <div className="flex items-center gap-md border-b border-border bg-surface-solid px-lg py-md">
              <span className="flex gap-xs" aria-hidden="true">
                <span className="size-[10px] rounded-full bg-danger" />
                <span className="size-[10px] rounded-full bg-accent" />
                <span className="size-[10px] rounded-full bg-success" />
              </span>
              <span className="text-small font-semibold text-text-muted">Panel del taller</span>
            </div>
            <div className="flex flex-col gap-lg p-xl">
              {[
                ['Órdenes activas', stats?.ordenesActivas],
                ['Vehículos atendidos', stats?.vehiculosAtendidos],
                ['Clientes activos', stats?.clientesActivos],
              ].map(([label, valor]) => (
                <div key={label} className="flex items-center justify-between gap-lg">
                  <span className="text-body text-text-muted">{label}</span>
                  <span className="font-display text-h1 font-extrabold tabular-nums text-text">
                    <CountUp value={valor} loading={statsLoading} anchoSkel="w-12" />
                  </span>
                </div>
              ))}
              <div className="flex flex-col gap-sm">
                <div className="flex justify-between text-small text-text-muted">
                  <span>Órdenes completadas</span>
                  <span className="tabular-nums">
                    {statsLoading ? '—' : <CountUp value={stats?.pctCompletadas} loading={statsLoading} suffix="%" anchoSkel="w-10" />}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-track-light">
                  {/* Anima el ancho una sola vez al llegar el dato. Es una barra
                      chica y un cambio puntual, no una animación en bucle. */}
                  <Motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: '0%' }}
                    animate={{ width: statsLoading ? '0%' : `${stats?.pctCompletadas ?? 0}%` }}
                    transition={RESORTE}
                  />
                </div>
              </div>
            </div>
          </div>
        </Motion.div>
      </section>

      {/* ── STATS ───────────────────────────────────────────── */}
      <section className="bg-bg py-2xl">
        <div className={CONTENEDOR}>
          <div ref={statsRef} className="grid grid-cols-4 gap-xl max-lg:grid-cols-2 max-sm:gap-lg">
            {STAT_DEFS.map((s, i) => (
              <Revelar key={s.key} i={i}>
                <div className={`${TARJETA} flex flex-col items-center gap-sm text-center`}>
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-on">
                    <s.Icon size={24} aria-hidden="true" />
                  </span>
                  <span className="font-display text-display font-extrabold tabular-nums leading-none text-text">
                    <CountUp value={stats?.[s.key]} loading={statsLoading} active={statsInView} />
                  </span>
                  <span className="text-small text-text-muted">{s.label}</span>
                </div>
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUIÉNES SOMOS ───────────────────────────────────── */}
      <section id="nosotros" className={SECCION}>
        <div className={`${CONTENEDOR} grid grid-cols-2 items-center gap-3xl max-lg:grid-cols-1`}>
          <Revelar>
            <p className={ETIQUETA_SECCION}>Quiénes somos</p>
            <h2 className={`${TITULO_SECCION} mt-lg`}>Más que un taller, somos tu aliado en el camino</h2>
            <p className="mt-lg text-h3 leading-normal text-text-muted">
              SIGOT Taller Automotriz nació en Copacabana con una misión clara: brindar un servicio honesto,
              técnico y confiable. Desde 2012 atendemos vehículos de todas las marcas con equipos de diagnóstico
              de última generación y un equipo humano apasionado por la mecánica.
            </p>
            <ul className="mt-xl flex flex-col gap-md">
              {['Diagnóstico certificado con scanner OBD2 profesional','Repuestos originales y de primera calidad','Historial completo de cada vehículo','Garantía por escrito en todos los servicios'].map(item => (
                <li key={item} className="flex items-start gap-md text-body text-text">
                  <span className="mt-[2px] flex size-5 shrink-0 items-center justify-center rounded-full
                                   bg-success-soft text-success-soft-on">
                    <MdCheck size={13} aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Revelar>

          <Revelar i={2}>
            <div className="relative">
              <div className="flex aspect-photo flex-col items-center justify-center gap-md rounded-lg
                              border border-border bg-surface-raised text-text-light">
                <MdDirectionsCar size={64} aria-hidden="true" />
                <p className="text-body">Taller SIGOT · Copacabana</p>
              </div>
              {/* Cifra sobre oscuro premium: el único bloque oscuro de la sección,
                  para que el dato ancle la vista. */}
              <div className="absolute -bottom-lg -left-lg flex items-center gap-md rounded-lg
                              bg-surface-dark px-xl py-lg shadow-lg">
                <span className="font-display text-display font-extrabold leading-none text-primary-pale-3">12</span>
                <span className="max-w-[7ch] text-small font-semibold leading-tight text-[var(--surface-dark-on)]">
                  años de experiencia
                </span>
              </div>
            </div>
          </Revelar>
        </div>
      </section>

      {/* ── SERVICIOS ────────────────────────────────────────── */}
      <section id="servicios" className={`${SECCION} bg-bg`}>
        <div className={CONTENEDOR}>
          <Revelar className="text-center">
            <p className={ETIQUETA_SECCION}>Lo que hacemos</p>
            <h2 className={`${TITULO_SECCION} mt-lg`}>Nuestros servicios</h2>
            <p className="mx-auto mt-lg max-w-[60ch] text-h3 leading-normal text-text-muted">
              Cubrimos todas las necesidades de tu vehículo con los mejores estándares del sector
            </p>
          </Revelar>
          <div className="mt-3xl grid grid-cols-3 gap-xl max-lg:grid-cols-2 max-sm:grid-cols-1">
            {SERVICES.map((s, i) => (
              <Revelar key={s.title} i={i}>
                <article className={TARJETA}>
                  <span className="mb-lg flex size-12 items-center justify-center rounded-md
                                   bg-primary-soft text-primary-soft-on">
                    <s.Icon size={26} aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-h2 font-bold tracking-tight text-text">{s.title}</h3>
                  <p className="mt-sm text-body leading-normal text-text-muted">{s.desc}</p>
                </article>
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      {/* ── RAZONES ─────────────────────────────────────────── */}
      <section className={SECCION}>
        <div className={CONTENEDOR}>
          <Revelar className="text-center">
            <p className={ETIQUETA_SECCION}>Por qué elegirnos</p>
            <h2 className={`${TITULO_SECCION} mt-lg`}>4 razones para confiar en nosotros</h2>
          </Revelar>
          <div className="mt-3xl grid grid-cols-4 gap-xl max-lg:grid-cols-2 max-sm:grid-cols-1">
            {REASONS.map((r, i) => (
              <Revelar key={r.eje} i={i}>
                <article className={`${TARJETA} border-t-[3px] border-t-primary`}>
                  <p className="text-caption font-bold uppercase tracking-wide text-primary-soft-on">{r.eje}</p>
                  <h3 className="mt-sm font-display text-h2 font-bold tracking-tight text-text">{r.title}</h3>
                  <p className="mt-sm text-body leading-normal text-text-muted">{r.desc}</p>
                </article>
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      {/* ── UBICACIÓN ───────────────────────────────────────── */}
      <section id="ubicacion" className={`${SECCION} bg-bg`}>
        <div className={CONTENEDOR}>
          <Revelar className="text-center">
            <p className={ETIQUETA_SECCION}>Dónde estamos</p>
            <h2 className={`${TITULO_SECCION} mt-lg`}>Encuéntranos</h2>
          </Revelar>
          <div className="mt-3xl grid grid-cols-[minmax(0,22rem)_1fr] gap-xl max-lg:grid-cols-1">
            <Revelar>
              <div className="flex flex-col gap-lg">
                {[
                  { Icon: MdLocationOn, titulo: 'Dirección', lineas: ['La Balladera, Copacabana, Antioquia'] },
                  { Icon: MdAccessTime, titulo: 'Horario de atención', lineas: ['Lunes a Viernes: 7:00 AM – 6:00 PM', 'Sábados: 8:00 AM – 2:00 PM'] },
                  { Icon: MdPhone, titulo: 'Teléfono', lineas: ['312 758 2709'] },
                  { Icon: MdEmail, titulo: 'Correo', lineas: ['jaircallevega@gmail.com'] },
                  /* NO se destructura el componente del parametro: eslint sin
                     eslint-plugin-react no reconoce <Icon /> como un uso de la
                     variable y la marca como no usada. Usando `d.Icon` la
                     variable `d` si cuenta como usada. */
                ].map((d) => (
                  <div key={d.titulo} className="flex items-start gap-md">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md
                                     bg-primary-soft text-primary-soft-on">
                      <d.Icon size={20} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-body font-bold text-text">{d.titulo}</strong>
                      {d.lineas.map(l => (
                        <p key={l} className="text-body text-text-muted [overflow-wrap:anywhere]">{l}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Revelar>

            <Revelar i={2}>
              {/* aspect-video reserva el hueco ANTES de que cargue el iframe: sin
                  él, el mapa aparece de golpe y empuja el pie de página. */}
              <div className="relative aspect-chart w-full overflow-hidden rounded-lg border border-border shadow-sm">
                <iframe
                  title="Ubicación SIGOT Taller"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.4!2d-75.5024!3d6.3516!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e4428b71b3c3a7f%3A0x1234567890abcdef!2sCopacabana%2C+Antioquia!5e0!3m2!1ses!2sco!4v1234567890"
                  className="size-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <div className="pointer-events-none absolute bottom-lg left-lg flex items-center gap-sm
                                rounded-full bg-surface px-lg py-sm shadow-md">
                  <span className="text-primary"><MdLocationOn size={22} aria-hidden="true" /></span>
                  <span className="text-small font-bold text-text">SIGOT Taller Automotriz</span>
                </div>
              </div>
            </Revelar>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="bg-surface-dark py-2xl text-[var(--surface-dark-on)]">
        <div className={CONTENEDOR}>
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-2xl max-md:grid-cols-1">
            <div>
              <span className="font-display text-h1 font-extrabold tracking-[0.16em] text-primary-pale-3">
                SIGOT
              </span>
              <p className="mt-md text-body leading-normal text-text-disabled">
                Sistema integral de gestión de órdenes y taller.<br />
                Copacabana, Antioquia — Colombia.
              </p>
            </div>
            {[
              { titulo: 'Navegación', items: SECCIONES.map(([id, label]) => ({ label, accion: () => scrollTo(id) })) },
              { titulo: 'Acceso', items: [
                { label: 'Agendar una cita', accion: () => navigate('/agendar') },
                { label: 'Ingresar al sistema', accion: () => navigate('/login') },
              ] },
            ].map(({ titulo, items }) => (
              <nav key={titulo} className="flex flex-col items-start gap-sm">
                <strong className="text-body font-bold">{titulo}</strong>
                {items.map(({ label, accion }) => (
                  <button
                    key={label}
                    onClick={accion}
                    className="cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit]
                               text-body text-text-disabled transition-colors duration-150
                               hover:text-primary-pale-3"
                  >
                    {label}
                  </button>
                ))}
              </nav>
            ))}
          </div>

          <div className="mt-2xl flex flex-wrap items-center justify-between gap-md border-t
                          border-[rgb(255_255_255_/_0.08)] pt-lg text-small text-text-disabled">
            <span>© 2026 SIGOT Taller Automotriz. Todos los derechos reservados.</span>
            <a
              href="https://wa.me/573127582709"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-xs transition-colors duration-150 hover:text-primary-pale-3"
            >
              <FiMessageSquare size={14} aria-hidden="true" /> WhatsApp Jair Calle
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
