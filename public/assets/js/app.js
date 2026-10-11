/* =============================================================
   app.js - nucleo compartido (sesion, API, layout, utilidades)
   ============================================================= */

const App = (() => {
  // Las paginas viven dentro de /public, la API un nivel arriba.
  // Funciona igual en XAMPP (/gineco/public -> /gineco/api) y en Vercel (raiz -> /api).
  const API_BASE = '../api';

  let usuario = null;
  let csrf = '';

  /* --------------------------- HTTP --------------------------- */
  /** Evita bucles de redireccion cuando la propia pagina de login pide la sesion. */
  function enPaginaLogin() {
    const pagina = window.location.pathname.split('/').pop();
    return pagina === '' || pagina === 'index.html';
  }

  async function api(ruta, opciones = {}) {
    const { method = 'GET', body = null, params = null, formData = null } = opciones;

    let url = API_BASE + '/' + ruta.replace(/^\/+/, '');
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, v);
      });
      const s = q.toString();
      if (s) url += (url.includes('?') ? '&' : '?') + s;
    }

    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (csrf) headers['X-CSRF-Token'] = csrf;

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        credentials: 'same-origin',
        body: formData || (body ? JSON.stringify(body) : null),
      });
    } catch (e) {
      throw { message: 'No se pudo conectar con el servidor', status: 0 };
    }

    let data = null;
    const texto = await res.text();
    try { data = texto ? JSON.parse(texto) : {}; } catch (e) { data = { ok: false }; }

    if (res.status === 401 && !ruta.startsWith('login') && !enPaginaLogin()) {
      window.location.href = 'index.html';
      throw { message: 'Sesion expirada', status: 401 };
    }
    if (!res.ok) {
      throw { message: (data && data.error) || 'Error inesperado', status: res.status };
    }
    return data;
  }

  /* --------------------------- sesion --------------------------- */
  async function init(opciones = {}) {
    let data;
    try {
      data = await api('session.php');
    } catch (e) {
      if (opciones.publica) return null;
      window.location.href = 'index.html';
      return null;
    }
    usuario = data.user;
    csrf = data.csrf || '';
    aplicarTema(usuario.medico);
    if (!opciones.sinLayout) pintarLayout(opciones.pagina);
    return usuario;
  }

  function usuarioActual() { return usuario; }
  function token() { return csrf; }

  /* --------------------------- tema --------------------------- */
  function hexRgb(hex) {
    const h = (hex || '').replace('#', '');
    const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(f || 'C2185B', 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function oscurecer({ r, g, b }, pct) {
    const f = (v) => Math.max(0, Math.round(v * (1 - pct)));
    return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
  }

  function aplicarTema(medico) {
    const primario = (medico && medico.color_primario) || '#C2185B';
    const { r, g, b } = hexRgb(primario);
    const s = document.documentElement.style;
    s.setProperty('--primary', primario);
    s.setProperty('--primary-dark', oscurecer({ r, g, b }, 0.18));
    s.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    s.setProperty('--primary-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);
    s.setProperty('--primary-softer', `rgba(${r}, ${g}, ${b}, 0.05)`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', primario);
  }

  /* --------------------------- layout --------------------------- */
  const ICONS = {
    dashboard: '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
    pacientes: '<path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>',
    citas: '<path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z"/>',
    reportes: '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>',
    usuarios: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    perfil: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    salir: '<path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>',
    buscar: '<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>',
    mas: '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>',
    chevron: '<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>',
    editar: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>',
    basura: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
    imprimir: '<path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>',
    imagen: '<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>',
    reloj: '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>',
    check: '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>',
    cerrar: '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
    subir: '<path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5z"/>',
    historia: '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>',
    flecha: '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>',
    corazon: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
    campana: '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>',
    shield: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>',
  };

  function icon(nombre, cls = '') {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[nombre] || ''}</svg>`;
  }

  function iniciales(nombre) {
    return (nombre || 'U')
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  const NAV = [
    { href: 'dashboard.html', id: 'dashboard', txt: 'Dashboard', ic: 'dashboard', soloMedico: true },
    { href: 'pacientes.html', id: 'pacientes', txt: 'Pacientes', ic: 'pacientes', soloMedico: true },
    { href: 'citas.html', id: 'citas', txt: 'Citas', ic: 'citas', soloMedico: true },
    { href: 'reportes.html', id: 'reportes', txt: 'Reportes', ic: 'reportes', soloMedico: true },
    { href: 'usuarios.html', id: 'usuarios', txt: 'Cuentas', ic: 'usuarios', soloAdmin: true },
    { href: 'perfil.html', id: 'perfil', txt: 'Mi perfil', ic: 'perfil' },
  ];

  function pintarLayout(pagina) {
    const esAdmin = usuario.rol === 'superadmin';
    const conMedico = !!usuario.medico;
    const medico = usuario.medico || {};

    const items = NAV
      .filter((n) => (n.soloMedico ? conMedico : true))
      .filter((n) => (n.soloAdmin ? esAdmin : true))
      .map((n) => `
        <a class="nav-item ${n.id === pagina ? 'active' : ''}" href="${n.href}">
          ${icon(n.ic)}<span>${n.txt}</span>
        </a>`)
      .join('');

    const logo = medico.logo_url
      ? `<div class="brand-logo"><img src="${medico.logo_url}" alt="logo"></div>`
      : `<div class="brand-logo">${medico.monograma || iniciales(medico.nombre || usuario.nombre)}</div>`;

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.innerHTML = `
        <div class="sidebar-brand">
          ${logo}
          <div class="brand-text">
            <strong>${escapeHtml(medico.nombre || usuario.nombre)}</strong>
            <span>${escapeHtml(medico.especialidad || (esAdmin ? 'Administracion' : 'Medicina'))}</span>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-label">Clinica</div>
          ${items}
        </nav>
        <div class="sidebar-foot">
          <div class="avatar">${medico.logo_url ? `<img src="${medico.logo_url}" alt="">` : iniciales(usuario.nombre)}</div>
          <div class="who">
            <strong>${escapeHtml(usuario.nombre)}</strong>
            <span>${esAdmin ? 'Superadmin' : 'Medico'}</span>
          </div>
          <button class="btn btn-icon btn-ghost" id="btnSalir" title="Cerrar sesion">${icon('salir')}</button>
        </div>`;
      sidebar.querySelector('#btnSalir').addEventListener('click', salir);
    }

    const topbar = document.getElementById('topbar');
    if (topbar) {
      const titulo = document.body.dataset.title || '';
      const sub = document.body.dataset.sub || '';
      topbar.innerHTML = `
        <button class="menu-toggle" id="btnMenu" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        </button>
        <div>
          <h2>${escapeHtml(titulo)}</h2>
          ${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''}
        </div>
        <div class="topbar-spacer"></div>
        <div class="search-box">
          ${icon('buscar')}
          <input id="buscadorGlobal" type="search" placeholder="Buscar paciente por nombre o cedula..." autocomplete="off">
        </div>`;

      topbar.querySelector('#btnMenu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('scrim')?.classList.toggle('open');
      });
      topbar.querySelector('#buscadorGlobal').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = e.target.value.trim();
          window.location.href = 'pacientes.html' + (q ? '?q=' + encodeURIComponent(q) : '');
        }
      });
    }

    const scrim = document.getElementById('scrim');
    if (scrim) {
      scrim.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        scrim.classList.remove('open');
      });
    }
  }

  async function salir() {
    try { await api('logout.php', { method: 'POST' }); } catch (e) { /* ignorar */ }
    window.location.href = 'index.html';
  }

  /* --------------------------- utilidades --------------------------- */
  function escapeHtml(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fecha(iso, corta = false) {
    if (!iso) return '—';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    if (!a) return iso;
    return corta ? `${d}/${m}` : `${d}/${m}/${a}`;
  }

  function hora(t) {
    if (!t) return '';
    return String(t).slice(0, 5);
  }

  function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function edad(fechaNac) {
    if (!fechaNac) return null;
    const n = new Date(fechaNac);
    if (isNaN(n)) return null;
    const h = new Date();
    let a = h.getFullYear() - n.getFullYear();
    const m = h.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
    return a;
  }

  function toast(mensaje, tipo = '') {
    let cont = document.getElementById('toasts');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'toasts';
      document.body.appendChild(cont);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + tipo;
    el.innerHTML = `<span>${escapeHtml(mensaje)}</span>`;
    cont.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(24px)';
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  function abrirModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
  }
  function cerrarModal(id) {
    const m = typeof id === 'string' ? document.getElementById(id) : id;
    if (m) m.classList.remove('open');
  }

  function confirmar(mensaje, titulo = 'Confirmar') {
    return new Promise((resolve) => {
      let bd = document.getElementById('modalConfirm');
      if (!bd) {
        bd = document.createElement('div');
        bd.id = 'modalConfirm';
        bd.className = 'modal-backdrop';
        document.body.appendChild(bd);
      }
      bd.innerHTML = `
        <div class="modal" style="max-width:430px">
          <div class="modal-head"><h3>${escapeHtml(titulo)}</h3>
            <button class="modal-close" data-x>${icon('cerrar')}</button></div>
          <div class="modal-body"><p style="margin:0;font-size:14.5px">${escapeHtml(mensaje)}</p></div>
          <div class="modal-foot">
            <button class="btn btn-ghost" data-no>Cancelar</button>
            <button class="btn btn-danger" data-si>Si, continuar</button>
          </div>
        </div>`;
      bd.classList.add('open');
      const fin = (val) => { bd.classList.remove('open'); resolve(val); };
      bd.querySelector('[data-x]').onclick = () => fin(false);
      bd.querySelector('[data-no]').onclick = () => fin(false);
      bd.querySelector('[data-si]').onclick = () => fin(true);
      bd.onclick = (e) => { if (e.target === bd) fin(false); };
    });
  }

  function cargando(contenido = 'Cargando...') {
    return `<div class="loading"><div class="spinner"></div>${escapeHtml(contenido)}</div>`;
  }

  function vacio(titulo, texto, ic = 'pacientes') {
    return `<div class="empty">
        <div class="icon">${icon(ic)}</div>
        <strong>${escapeHtml(titulo)}</strong>
        <span>${escapeHtml(texto)}</span>
      </div>`;
  }

  function debounce(fn, ms = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function parametros() {
    return new URLSearchParams(window.location.search);
  }

  function paginar(total, pagina, porPagina, contenedorId, alCambiar) {
    const cont = document.getElementById(contenedorId);
    if (!cont) return;
    const paginas = Math.max(1, Math.ceil(total / porPagina));
    if (paginas <= 1) { cont.innerHTML = ''; return; }
    const botones = [];
    botones.push(`<button ${pagina <= 1 ? 'disabled' : ''} data-p="${pagina - 1}">&lsaquo;</button>`);
    for (let i = 1; i <= paginas; i++) {
      if (paginas > 7 && i > 2 && i < paginas - 1 && Math.abs(i - pagina) > 1) {
        if (botones[botones.length - 1] !== '<span>…</span>') botones.push('<span>…</span>');
        continue;
      }
      botones.push(`<button class="${i === pagina ? 'on' : ''}" data-p="${i}">${i}</button>`);
    }
    botones.push(`<button ${pagina >= paginas ? 'disabled' : ''} data-p="${pagina + 1}">&rsaquo;</button>`);
    cont.innerHTML = botones.join('');
    cont.querySelectorAll('button[data-p]').forEach((b) => {
      b.addEventListener('click', () => alCambiar(parseInt(b.dataset.p, 10)));
    });
  }

  function leerForm(contenedor) {
    const datos = {};
    contenedor.querySelectorAll('[name]').forEach((el) => {
      const nombre = el.name;
      if (el.type === 'checkbox') {
        datos[nombre] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) datos[nombre] = el.value;
      } else {
        datos[nombre] = el.value;
      }
    });
    return datos;
  }

  function llenarForm(contenedor, datos) {
    if (!datos) return;
    contenedor.querySelectorAll('[name]').forEach((el) => {
      const v = datos[el.name];
      if (v === undefined || v === null) return;
      if (el.type === 'checkbox') el.checked = v === true || v === 'true' || v === '1' || v === 1;
      else if (el.type === 'radio') el.checked = (el.value == v);
      else el.value = String(v);
    });
  }

  function pintarChecks(root) {
    root.querySelectorAll('.check input').forEach((i) => {
      i.closest('.check').classList.toggle('on', i.checked);
      if (!i.dataset.bindeado) {
        i.dataset.bindeado = '1';
        i.addEventListener('change', () => {
          i.closest('.check').classList.toggle('on', i.checked);
        });
      }
    });
  }

  return {
    api,
    init,
    icon,
    usuarioActual,
    token,
    escapeHtml,
    fecha,
    hora,
    hoy,
    edad,
    toast,
    abrirModal,
    cerrarModal,
    confirmar,
    cargando,
    vacio,
    debounce,
    parametros,
    paginar,
    leerForm,
    llenarForm,
    pintarChecks,
    iniciales,
    salir,
  };
})();

/* Secciones colapsables (delegacion global) */
document.addEventListener('click', (e) => {
  const head = e.target.closest('.section-head');
  if (head && !e.target.closest('input, select, textarea, button, a')) {
    head.parentElement.classList.toggle('collapsed');
  }
});
