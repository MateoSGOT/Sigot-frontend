import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdBuild, MdSearch, MdRotateRight, MdElectricBolt, MdDoNotDisturb, MdInvertColors,
  MdDirectionsCar, MdCheck, MdLocationOn, MdAccessTime, MdPhone, MdEmail,
} from 'react-icons/md';
import { FiFacebook, FiInstagram, FiMessageSquare } from 'react-icons/fi';
import './LandingPage.css';

/* ─── Data ─────────────────────────────────────────────────── */
const STATS = [
  { value: '12+', label: 'Años en el mercado' },
  { value: '1.2K+', label: 'Vehículos atendidos' },
  { value: '800+', label: 'Clientes satisfechos' },
  { value: '99%', label: 'Índice de satisfacción' },
];

const SERVICES = [
  { Icon: MdBuild,          title: 'Mantenimiento preventivo', desc: 'Revisión completa de 60 puntos para mantener tu vehículo en óptimas condiciones.' },
  { Icon: MdSearch,         title: 'Diagnóstico computarizado', desc: 'Escáner OBD2 profesional para detectar fallas con precisión milimétrica.' },
  { Icon: MdRotateRight,    title: 'Alineación y balanceo', desc: 'Corregimos la geometría de dirección y balanceo de llantas con tecnología 3D.' },
  { Icon: MdElectricBolt,   title: 'Sistema eléctrico', desc: 'Diagnóstico y reparación de baterías, alternadores, sensores y cableado.' },
  { Icon: MdDoNotDisturb,   title: 'Sistema de frenos', desc: 'Inspección, ajuste y cambio de pastillas, discos y líquido de frenos.' },
  { Icon: MdInvertColors,   title: 'Cambio de aceite y filtros', desc: 'Cambio con aceites certificados y filtros originales para mayor durabilidad del motor.' },
];

const REASONS = [
  { num: '01', title: 'Técnicos certificados', desc: 'Nuestro equipo cuenta con certificaciones internacionales y experiencia comprobada en todas las marcas.' },
  { num: '02', title: 'Tecnología de punta', desc: 'Herramientas y escáneres de última generación para diagnósticos precisos y rápidos.' },
  { num: '03', title: 'Transparencia total', desc: 'Te mostramos qué se hace y por qué. Sin cobros ocultos, sin sorpresas en la factura.' },
  { num: '04', title: 'Garantía real', desc: 'Todos nuestros servicios incluyen garantía por escrito. Tu tranquilidad es nuestra prioridad.' },
];

const TEAM = [
  { name: 'Carlos Rodríguez', role: 'Jefe de Taller', initials: 'CR' },
  { name: 'Ana Martínez', role: 'Técnica Especialista', initials: 'AM' },
  { name: 'Luis Herrera', role: 'Diagnóstico Electrónico', initials: 'LH' },
  { name: 'Diana Torres', role: 'Recepcionista', initials: 'DT' },
];

/* ─── Intersection Observer hook ───────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ─── Components ────────────────────────────────────────────── */
function AnimSection({ children, className = '', delay = 0 }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`anim-section ${inView ? 'anim-section--visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', correo: '', telefono: '', mensaje: '' });
  const [formSent, setFormSent] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFormChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleFormSubmit = e => {
    e.preventDefault();
    setFormSent(true);
    setTimeout(() => setFormSent(false), 4000);
    setFormData({ nombre: '', correo: '', telefono: '', mensaje: '' });
  };

  return (
    <div className="landing">

      {/* ── NAVBAR ──────────────────────────────────────────── */}
      <nav className={`landing-nav${scrolled ? ' landing-nav--scrolled' : ''}`}>
        <div className="landing-nav__inner">
          <div className="landing-nav__brand" onClick={() => scrollTo('hero')}>
            <div className="landing-nav__logo">S</div>
            <span className="landing-nav__name">SIGOT</span>
          </div>

          <div className={`landing-nav__links${menuOpen ? ' landing-nav__links--open' : ''}`}>
            {[['servicios','Servicios'],['nosotros','Nosotros'],['equipo','Equipo'],['ubicacion','Ubicación'],['contacto','Contacto']].map(([id,label]) => (
              <button key={id} className="landing-nav__link" onClick={() => scrollTo(id)}>{label}</button>
            ))}
          </div>

          <div className="landing-nav__cta">
            <button className="landing-btn landing-btn--primary" onClick={() => navigate('/login')}>
              Ingresar al sistema
            </button>
            <button className="landing-nav__burger" onClick={() => setMenuOpen(p => !p)} aria-label="Menú">
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section id="hero" className="landing-hero">
        <div className="landing-hero__bg">
          <div className="landing-hero__blob landing-hero__blob--1" />
          <div className="landing-hero__blob landing-hero__blob--2" />
          <div className="landing-hero__blob landing-hero__blob--3" />
        </div>
        <div className="landing-hero__content">
          <div className="landing-hero__badge">Taller especializado · Copacabana, Antioquia</div>
          <h1 className="landing-hero__title">
            Tu vehículo merece<br />
            <span className="landing-hero__accent">lo mejor</span>
          </h1>
          <p className="landing-hero__subtitle">
            Más de 12 años de experiencia en mantenimiento, diagnóstico y reparación
            de vehículos en La Balladera. Tecnología de punta, técnicos certificados.
          </p>
          <div className="landing-hero__actions">
            <button className="landing-btn landing-btn--primary landing-btn--lg" onClick={() => scrollTo('contacto')}>
              Agendar cita
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7,7 17,7 17,17"/></svg>
            </button>
            <button className="landing-btn landing-btn--outline landing-btn--lg" onClick={() => scrollTo('servicios')}>
              Ver servicios
            </button>
          </div>
        </div>
        <div className="landing-hero__visual">
          <div className="landing-hero__card">
            <div className="landing-hero__card-header">
              <div className="landing-hero__dot landing-hero__dot--red" />
              <div className="landing-hero__dot landing-hero__dot--yellow" />
              <div className="landing-hero__dot landing-hero__dot--green" />
            </div>
            <div className="landing-hero__card-body">
              <div className="landing-hero__stat-row">
                <span className="landing-hero__stat-label">Órdenes activas</span>
                <span className="landing-hero__stat-value">24</span>
              </div>
              <div className="landing-hero__stat-row">
                <span className="landing-hero__stat-label">Completadas hoy</span>
                <span className="landing-hero__stat-value landing-hero__stat-value--green">8</span>
              </div>
              <div className="landing-hero__stat-row">
                <span className="landing-hero__stat-label">Satisfacción</span>
                <span className="landing-hero__stat-value landing-hero__stat-value--green">99%</span>
              </div>
              <div className="landing-hero__progress">
                <div className="landing-hero__progress-label">
                  <span>Capacidad del taller</span><span>75%</span>
                </div>
                <div className="landing-hero__progress-bar">
                  <div className="landing-hero__progress-fill" style={{ width: '75%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────── */}
      <section className="landing-stats">
        <div className="landing-container">
          <div className="landing-stats__grid">
            {STATS.map((s, i) => (
              <AnimSection key={s.label} delay={i * 80}>
                <div className="landing-stat-card">
                  <span className="landing-stat-card__value">{s.value}</span>
                  <span className="landing-stat-card__label">{s.label}</span>
                </div>
              </AnimSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUIÉNES SOMOS ───────────────────────────────────── */}
      <section id="nosotros" className="landing-section landing-about">
        <div className="landing-container landing-about__inner">
          <AnimSection className="landing-about__text">
            <div className="landing-section__tag">Quiénes somos</div>
            <h2 className="landing-section__title">Más que un taller, somos tu aliado en el camino</h2>
            <p className="landing-about__desc">
              SIGOT Taller Automotriz nació en Copacabana con una misión clara: brindar un servicio honesto,
              técnico y confiable. Desde 2012 atendemos vehículos de todas las marcas con equipos de diagnóstico
              de última generación y un equipo humano apasionado por la mecánica.
            </p>
            <ul className="landing-about__list">
              {['Diagnóstico certificado con scanner OBD2 profesional','Repuestos originales y de primera calidad','Historial completo de cada vehículo','Garantía por escrito en todos los servicios'].map(item => (
                <li key={item} className="landing-about__list-item">
                  <span className="landing-about__check"><MdCheck size={13} /></span>
                  {item}
                </li>
              ))}
            </ul>
            <button className="landing-btn landing-btn--primary" onClick={() => scrollTo('contacto')}>
              Contáctanos
            </button>
          </AnimSection>
          <AnimSection className="landing-about__visual" delay={150}>
            <div className="landing-about__img-wrap">
              <div className="landing-about__img-placeholder">
                <div className="landing-about__img-icon"><MdDirectionsCar size={64} /></div>
                <p>Taller SIGOT · Copacabana</p>
              </div>
              <div className="landing-about__badge-float">
                <span className="landing-about__badge-num">12</span>
                <span className="landing-about__badge-txt">años de experiencia</span>
              </div>
            </div>
          </AnimSection>
        </div>
      </section>

      {/* ── SERVICIOS ────────────────────────────────────────── */}
      <section id="servicios" className="landing-section landing-services">
        <div className="landing-container">
          <AnimSection>
            <div className="landing-section__tag">Lo que hacemos</div>
            <h2 className="landing-section__title landing-section__title--center">Nuestros servicios</h2>
            <p className="landing-section__subtitle">
              Cubrimos todas las necesidades de tu vehículo con los mejores estándares del sector
            </p>
          </AnimSection>
          <div className="landing-services__grid">
            {SERVICES.map((s, i) => (
              <AnimSection key={s.title} delay={i * 60}>
                <div className="landing-service-card">
                  <div className="landing-service-card__icon"><s.Icon size={26} /></div>
                  <h3 className="landing-service-card__title">{s.title}</h3>
                  <p className="landing-service-card__desc">{s.desc}</p>
                </div>
              </AnimSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── RAZONES ─────────────────────────────────────────── */}
      <section className="landing-section landing-reasons">
        <div className="landing-container">
          <AnimSection>
            <div className="landing-section__tag">Por qué elegirnos</div>
            <h2 className="landing-section__title landing-section__title--center">
              4 razones para confiar en nosotros
            </h2>
          </AnimSection>
          <div className="landing-reasons__grid">
            {REASONS.map((r, i) => (
              <AnimSection key={r.num} delay={i * 80}>
                <div className="landing-reason-card">
                  <div className="landing-reason-card__num">{r.num}</div>
                  <h3 className="landing-reason-card__title">{r.title}</h3>
                  <p className="landing-reason-card__desc">{r.desc}</p>
                </div>
              </AnimSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── EQUIPO ──────────────────────────────────────────── */}
      <section id="equipo" className="landing-section landing-team">
        <div className="landing-container">
          <AnimSection>
            <div className="landing-section__tag">Nuestro equipo</div>
            <h2 className="landing-section__title landing-section__title--center">Personal altamente capacitado</h2>
            <p className="landing-section__subtitle">
              Profesionales con formación continua y certificaciones técnicas
            </p>
          </AnimSection>
          <div className="landing-team__grid">
            {TEAM.map((m, i) => (
              <AnimSection key={m.name} delay={i * 70}>
                <div className="landing-team-card">
                  <div className="landing-team-card__avatar">{m.initials}</div>
                  <h3 className="landing-team-card__name">{m.name}</h3>
                  <p className="landing-team-card__role">{m.role}</p>
                </div>
              </AnimSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── UBICACIÓN ───────────────────────────────────────── */}
      <section id="ubicacion" className="landing-section landing-location">
        <div className="landing-container">
          <AnimSection>
            <div className="landing-section__tag">Dónde estamos</div>
            <h2 className="landing-section__title landing-section__title--center">Encuéntranos</h2>
          </AnimSection>
          <div className="landing-location__inner">
            <AnimSection className="landing-location__info">
              <div className="landing-location__detail">
                <div className="landing-location__icon"><MdLocationOn size={20} /></div>
                <div>
                  <strong>Dirección</strong>
                  <p>La Balladera, Copacabana, Antioquia</p>
                </div>
              </div>
              <div className="landing-location__detail">
                <div className="landing-location__icon"><MdAccessTime size={20} /></div>
                <div>
                  <strong>Horario de atención</strong>
                  <p>Lunes a Viernes: 7:00 AM – 6:00 PM</p>
                  <p>Sábados: 8:00 AM – 2:00 PM</p>
                </div>
              </div>
              <div className="landing-location__detail">
                <div className="landing-location__icon"><MdPhone size={20} /></div>
                <div>
                  <strong>Teléfono</strong>
                  <p>+57 300 123 4567</p>
                </div>
              </div>
              <div className="landing-location__detail">
                <div className="landing-location__icon"><MdEmail size={20} /></div>
                <div>
                  <strong>Correo</strong>
                  <p>sigot@taller.com</p>
                </div>
              </div>
            </AnimSection>
            <AnimSection className="landing-location__map" delay={120}>
              <div className="landing-map-wrap">
                <iframe
                  title="Ubicación SIGOT Taller"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.4!2d-75.5024!3d6.3516!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e4428b71b3c3a7f%3A0x1234567890abcdef!2sCopacabana%2C+Antioquia!5e0!3m2!1ses!2sco!4v1234567890"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="landing-map__pin">
                  <div className="landing-map__pin-icon"><MdLocationOn size={22} /></div>
                  <div className="landing-map__pin-label">SIGOT Taller Automotriz</div>
                </div>
              </div>
            </AnimSection>
          </div>
        </div>
      </section>

      {/* ── CONTACTO ─────────────────────────────────────────── */}
      <section id="contacto" className="landing-section landing-contact">
        <div className="landing-container">
          <AnimSection>
            <div className="landing-section__tag">Contáctanos</div>
            <h2 className="landing-section__title landing-section__title--center">¿Listo para agendar?</h2>
            <p className="landing-section__subtitle">Escríbenos y nos comunicamos en menos de 24 horas</p>
          </AnimSection>
          <AnimSection delay={100}>
            <div className="landing-contact__card">
              {formSent ? (
                <div className="landing-contact__success">
                  <div className="landing-contact__success-icon"><MdCheck size={28} /></div>
                  <h3>¡Mensaje enviado!</h3>
                  <p>Nos pondremos en contacto contigo pronto.</p>
                </div>
              ) : (
                <form className="landing-contact__form" onSubmit={handleFormSubmit} noValidate>
                  <div className="landing-contact__row">
                    <div className="landing-contact__group">
                      <label>Nombre completo</label>
                      <input name="nombre" value={formData.nombre} onChange={handleFormChange} placeholder="Tu nombre" required />
                    </div>
                    <div className="landing-contact__group">
                      <label>Correo electrónico</label>
                      <input name="correo" type="email" value={formData.correo} onChange={handleFormChange} placeholder="correo@ejemplo.com" required />
                    </div>
                  </div>
                  <div className="landing-contact__group">
                    <label>Teléfono</label>
                    <input name="telefono" value={formData.telefono} onChange={handleFormChange} placeholder="3XX XXX XXXX" />
                  </div>
                  <div className="landing-contact__group">
                    <label>Mensaje</label>
                    <textarea name="mensaje" value={formData.mensaje} onChange={handleFormChange} rows={4} placeholder="Cuéntanos sobre tu vehículo y el servicio que necesitas..." required />
                  </div>
                  <button type="submit" className="landing-btn landing-btn--primary landing-btn--full">
                    Enviar mensaje
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
                  </button>
                </form>
              )}
            </div>
          </AnimSection>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer__inner">
            <div className="landing-footer__brand">
              <div className="landing-footer__logo">
                <div className="landing-nav__logo">S</div>
                <span className="landing-nav__name">SIGOT</span>
              </div>
              <p className="landing-footer__desc">
                Sistema integral de gestión de órdenes y taller.<br />
                Copacabana, Antioquia — Colombia.
              </p>
            </div>
            <div className="landing-footer__links">
              <strong>Navegación</strong>
              {[['servicios','Servicios'],['nosotros','Nosotros'],['equipo','Equipo'],['ubicacion','Ubicación'],['contacto','Contacto']].map(([id,label]) => (
                <button key={id} onClick={() => scrollTo(id)}>{label}</button>
              ))}
            </div>
            <div className="landing-footer__links">
              <strong>Acceso</strong>
              <button onClick={() => navigate('/login')}>Ingresar al sistema</button>
              <button onClick={() => navigate('/portal')}>Portal del cliente</button>
            </div>
          </div>
          <div className="landing-footer__bottom">
            <span>© 2026 SIGOT Taller Automotriz. Todos los derechos reservados.</span>
            <div className="landing-footer__socials">
              <span style={{display:'inline-flex',alignItems:'center',gap:'0.375rem'}}><FiMessageSquare size={14} /> WhatsApp</span>
              <span style={{display:'inline-flex',alignItems:'center',gap:'0.375rem'}}><FiFacebook size={14} /> Facebook</span>
              <span style={{display:'inline-flex',alignItems:'center',gap:'0.375rem'}}><FiInstagram size={14} /> Instagram</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
