/* historia.js - formulario de Historia Clinica Ginecologica (9 secciones) */
(() => {
  const $ = (s) => document.querySelector(s);
  const params = App.parametros();

  const secCabecera = $('#secCabecera');
  const secPersonal = $('#secPersonal');
  const secAntecedentes = $('#secAntecedentes');
  const secGineco = $('#secGineco');
  const secFisico = $('#secFisico');
  const secGinecoExamen = $('#secGinecoExamen');
  const secDiagnostico = $('#secDiagnostico');
  const tbodyPara = $('#tablaParaclinicos tbody');
  const gridImagenes = $('#gridImagenes');

  const state = {
    pacienteId: 0,
    paciente: null,
    historia: null,
    consultas: [],
    consultaId: params.get('c') ? +params.get('c') : null,
    imagenes: [],
    editando: false,
  };

  /* chevron de secciones */
  document.querySelectorAll('.section-head .toggle').forEach((t) => {
    t.innerHTML = App.icon('chevron');
  });

  /* -------------------------- utilidades de UI -------------------------- */
  function aviso(txt, tipo = 'blue') {
    const caja = $('#aviso');
    if (!txt) { caja.classList.add('hide'); return; }
    caja.className = '';
    caja.style.cssText = `background:var(--${tipo === 'blue' ? 'info' : tipo}-soft);border:1px solid rgba(0,0,0,.06);border-radius:11px;padding:12px 16px;font-size:13.5px;color:var(--text-2);margin-bottom:16px`;
    caja.innerHTML = `<strong style="color:var(--text)">${App.escapeHtml(txt)}</strong>`;
  }

  function cabeceraPaciente() {
    const p = state.paciente;
    $('#nombrePaciente').textContent = p.nombre || 'Paciente';
    const bits = [
      `<span class="badge rosa no-dot">N° ${App.escapeHtml(state.historia?.numero || p.registro_numero || '—')}</span>`,
      p.cedula ? `<span class="badge gray no-dot">CI ${App.escapeHtml(p.cedula)}</span>` : '',
      p.edad ? `<span class="badge gray no-dot">${p.edad} años</span>` : '',
      p.telefono ? `<span class="badge gray no-dot">${App.escapeHtml(p.telefono)}</span>` : '',
    ].filter(Boolean);
    $('#datosPaciente').innerHTML = bits.join('');
    $('#registroHistoria').value = state.historia?.numero || p.registro_numero || '';
  }

  /* -------------------------- paraclinicos -------------------------- */
  function filaParaclinico(f = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="input" data-k="nombre" placeholder="Ecografia transvaginal" value="${App.escapeHtml(f.nombre || '')}"></td>
      <td><input class="input" type="date" data-k="fecha" value="${App.escapeHtml((f.fecha || '').slice(0, 10))}"></td>
      <td><input class="input" data-k="resultado" placeholder="Hallazgos" value="${App.escapeHtml(f.resultado || '')}"></td>
      <td><input class="input" data-k="observaciones" placeholder="Control..." value="${App.escapeHtml(f.observaciones || '')}"></td>
      <td class="text-right"><button type="button" class="btn btn-ghost btn-sm" title="Quitar">${App.icon('basura')}</button></td>`;
    tr.querySelector('button').addEventListener('click', () => tr.remove());
    return tr;
  }

  function pintarParaclinicos(lista) {
    tbodyPara.innerHTML = '';
    (lista || []).forEach((f) => tbodyPara.appendChild(filaParaclinico(f)));
    if (!tbodyPara.children.length) tbodyPara.appendChild(filaParaclinico());
  }

  function leerParaclinicos() {
    return [...tbodyPara.querySelectorAll('tr')].map((tr) => {
      const o = {};
      tr.querySelectorAll('[data-k]').forEach((i) => { o[i.dataset.k] = i.value.trim(); });
      return o;
    }).filter((o) => o.nombre);
  }

  $('#btnParaclinico').addEventListener('click', () => {
    tbodyPara.appendChild(filaParaclinico());
    tbodyPara.lastElementChild.querySelector('input').focus();
  });

  /* -------------------------- imagenes -------------------------- */
  function pintarImagenes() {
    if (!state.imagenes.length) {
      gridImagenes.innerHTML = '';
      return;
    }
    gridImagenes.innerHTML = state.imagenes.map((img) => {
      const esPdf = (img.mime || '').includes('pdf');
      const mini = esPdf
        ? `<div class="pdf-tag"><svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>PDF</div>`
        : `<img src="${App.escapeHtml(img.url || '')}" alt="${App.escapeHtml(img.titulo || 'imagen')}" loading="lazy">`;
      return `
        <div class="img-card" data-img="${img.id}">
          <div class="img-thumb" data-ver="${App.escapeHtml(img.url || '')}">${mini}</div>
          <div class="img-meta">
            <div class="row">
              <input class="input" data-campo="fecha" type="date" value="${App.escapeHtml((img.fecha || '').slice(0, 10))}" title="Fecha">
              <input class="input" data-campo="tipo" value="${App.escapeHtml(img.tipo || 'Ecografia')}" title="Tipo">
            </div>
            <input class="input" data-campo="titulo" placeholder="Titulo / estudio" value="${App.escapeHtml(img.titulo || '')}">
            <input class="input" data-campo="observaciones" placeholder="Observaciones" value="${App.escapeHtml(img.observaciones || '')}">
            <div class="flex between center">
              <span class="text-sm text-muted">${img.consulta_id ? 'Adjunta' : 'Pendiente de guardar'}</span>
              <button class="btn btn-ghost btn-sm" data-quitar="${img.id}" style="color:var(--danger)">${App.icon('basura')}</button>
            </div>
          </div>
        </div>`;
    }).join('');

    gridImagenes.querySelectorAll('[data-ver]').forEach((el) => {
      el.addEventListener('click', () => { if (el.dataset.ver) window.open(el.dataset.ver, '_blank'); });
    });
    gridImagenes.querySelectorAll('[data-quitar]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = +b.dataset.quitar;
        const ok = await App.confirmar('Eliminar esta imagen del estudio?', 'Eliminar imagen');
        if (!ok) return;
        try {
          await App.api('imagenes.php', { method: 'DELETE', params: { id } });
          state.imagenes = state.imagenes.filter((i) => i.id !== id);
          pintarImagenes();
          App.toast('Imagen eliminada', 'ok');
        } catch (e) { App.toast(e.message, 'err'); }
      });
    });
    gridImagenes.querySelectorAll('[data-campo]').forEach((i) => {
      i.addEventListener('change', () => {
        const tarjeta = i.closest('[data-img]');
        const img = state.imagenes.find((x) => x.id === +tarjeta.dataset.img);
        if (img) img[i.dataset.campo] = i.value;
      });
    });
  }

  async function subirArchivos(lista) {
    if (!state.pacienteId) { App.toast('Guarda el paciente primero', 'err'); return; }
    for (const archivo of lista) {
      const fd = new FormData();
      fd.append('file', archivo);
      fd.append('paciente_id', state.pacienteId);
      if (state.consultaId) fd.append('consulta_id', state.consultaId);
      fd.append('fecha', App.hoy());
      fd.append('tipo', 'Ecografia');
      fd.append('titulo', archivo.name.replace(/\.[^.]+$/, ''));
      try {
        const r = await App.api('imagenes.php', { method: 'POST', formData: fd });
        state.imagenes.push(r.imagen);
      } catch (e) {
        App.toast(`${archivo.name}: ${e.message}`, 'err');
      }
    }
    pintarImagenes();
    App.toast('Imagen(es) cargadas', 'ok');
  }

  const dz = $('#dropzone');
  const inputArchivos = $('#inputArchivos');
  dz.addEventListener('click', () => inputArchivos.click());
  inputArchivos.addEventListener('change', () => { subirArchivos([...inputArchivos.files]); inputArchivos.value = ''; });
  ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => subirArchivos([...e.dataTransfer.files]));

  /* -------------------------- IMC -------------------------- */
  function calcularIMC() {
    const peso = parseFloat($('#peso').value);
    const talla = parseFloat($('#talla').value);
    if (!peso || !talla || talla <= 0) { $('#imc').value = ''; $('#imcClase').value = ''; return; }
    const imc = peso / Math.pow(talla / 100, 2);
    $('#imc').value = imc.toFixed(2);
    $('#imcClase').value =
      imc < 18.5 ? 'Bajo peso' : imc < 25 ? 'Normal' : imc < 30 ? 'Sobrepeso' : 'Obesidad';
  }
  $('#peso').addEventListener('input', calcularIMC);
  $('#talla').addEventListener('input', calcularIMC);

  $('#fechaNacPaciente').addEventListener('change', (e) => {
    const a = App.edad(e.target.value);
    if (a !== null && a >= 0) $('#edadPaciente').value = a;
  });

  /* -------------------------- cargar -------------------------- */
  function mostrarCarga(on) {
    document.querySelectorAll('main .section, main .page-head, main #aviso')
      .forEach((el) => el.classList.toggle('hide', on));
    let caja = document.getElementById('cajaCarga');
    if (on && !caja) {
      caja = document.createElement('div');
      caja.id = 'cajaCarga';
      caja.innerHTML = App.cargando('Cargando historia clinica...');
      document.querySelector('main').prepend(caja);
    }
    if (!on && caja) caja.remove();
  }

  async function cargarContexto() {
    mostrarCarga(true);
    const d = await App.api('historia.php', { params: { paciente: state.pacienteId } });
    state.paciente = d.paciente;
    state.historia = d.historia;
    state.consultas = d.consultas;
    state.imagenesPaciente = d.imagenes || [];

    cabeceraPaciente();
    App.llenarForm(secPersonal, d.paciente);

    if (state.consultas.length) {
      try {
        const prev = await App.api('historia.php', { params: { consulta: state.consultas[0].id } });
        state.ultimaCarga = prev.consulta;
      } catch (e) { /* sin precarga */ }
    }

    if (state.consultaId) {
      await cargarConsulta(state.consultaId, false);
    } else {
      nuevaConsulta(true);
    }
    pintarTimeline();
    mostrarCarga(false);
  }

  async function cargarConsulta(id, mostrarAviso = true) {
    try {
      const d = await App.api('historia.php', { params: { consulta: id } });
      const c = d.consulta;
      state.consultaId = c.id;
      state.editando = true;
      history.replaceState(null, '', `historia.html?p=${state.pacienteId}&c=${c.id}`);

      App.llenarForm(secCabecera, c);
      App.llenarForm(secPersonal, state.paciente);
      App.llenarForm(secAntecedentes, c.antecedentes || {});
      App.llenarForm(secGineco, c.gineco || {});
      App.llenarForm(secFisico, c.examen_fisico || {});
      App.llenarForm(secGinecoExamen, c.examen_ginecologico || {});
      App.llenarForm(secDiagnostico, c);
      App.pintarChecks(secAntecedentes);
      pintarParaclinicos(c.paraclinicos);
      state.imagenes = c.imagenes || [];
      pintarImagenes();
      calcularIMC();

      $('#fechaConsulta').value = (c.fecha_consulta || '').slice(0, 10);
      $('#btnGuardar').textContent = 'Guardar cambios';
      $('#btnGuardar2').textContent = 'Guardar cambios';
      aviso(mostrarAviso ? `Editando consulta N° ${c.numero} del ${App.fecha(c.fecha_consulta)}` : '');
      pintarTimeline();
    } catch (e) {
      App.toast(e.message, 'err');
    }
  }

  function nuevaConsulta(prefill = true) {
    state.consultaId = null;
    state.editando = false;
    history.replaceState(null, '', `historia.html?p=${state.pacienteId}`);

    formReset(secCabecera);
    formReset(secFisico);
    formReset(secGinecoExamen);
    formReset(secDiagnostico);
    pintarParaclinicos([]);
    state.imagenes = (state.imagenesPaciente || []).filter((i) => !i.consulta_id);
    pintarImagenes();

    $('#fechaConsulta').value = App.hoy();

    const previa = state.ultimaCarga || null;
    if (prefill && previa) {
      App.llenarForm(secAntecedentes, previa.antecedentes || {});
      App.llenarForm(secGineco, previa.gineco || {});
      App.pintarChecks(secAntecedentes);
      aviso('Nueva consulta: se precargaron los antecedentes de la ultima visita.');
    } else {
      aviso('Nueva consulta en curso. Recuerda guardar para registrarla.');
    }

    $('#btnGuardar').textContent = 'Guardar consulta';
    $('#btnGuardar2').textContent = 'Guardar consulta';
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('collapsed'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function formReset(cont) {
    cont.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.readOnly) return;
      if (el.type === 'checkbox') el.checked = false;
      else if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
    App.pintarChecks(cont);
  }

  function pintarTimeline() {
    const cont = $('#timeline');
    if (!state.consultas.length) {
      cont.innerHTML = App.vacio('Sin consultas registradas', 'Guarda la primera consulta para abrir el historial.', 'historia');
      return;
    }
    cont.innerHTML = state.consultas.map((c) => `
      <div class="timeline-item ${c.id === state.consultaId ? 'actual' : ''}">
        <div class="t-date">${App.fecha(c.fecha_consulta)} · Consulta N° ${c.numero}</div>
        <div class="t-title">${App.escapeHtml(c.diagnostico || c.motivo_consulta || 'Sin diagnostico registrado')}</div>
        <div class="t-body">${App.escapeHtml((c.motivo_consulta || '').slice(0, 150))}</div>
        <div class="t-actions">
          <button class="btn btn-soft btn-sm" data-ver-consulta="${c.id}">Ver / editar</button>
          ${c.proxima_cita ? `<span class="badge blue no-dot">Proxima: ${App.fecha(c.proxima_cita)}</span>` : ''}
        </div>
      </div>`).join('');

    cont.querySelectorAll('[data-ver-consulta]').forEach((b) => {
      b.addEventListener('click', () => cargarConsulta(+b.dataset.verConsulta));
    });
  }

  /* -------------------------- guardar -------------------------- */
  function armarPayload() {
    const cab = App.leerForm(secCabecera);
    const personal = App.leerForm(secPersonal);
    const antecedentes = App.leerForm(secAntecedentes);
    const gineco = App.leerForm(secGineco);
    const fisico = App.leerForm(secFisico);
    const gineExamen = App.leerForm(secGinecoExamen);
    const diag = App.leerForm(secDiagnostico);

    if (!personal.nombre || !personal.nombre.trim()) {
      App.toast('El nombre del paciente es obligatorio', 'err');
      secPersonal.classList.remove('collapsed');
      secPersonal.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    if (!cab.fecha_consulta) {
      App.toast('Indica la fecha de consulta', 'err');
      secCabecera.classList.remove('collapsed');
      return null;
    }

    return {
      consulta_id: state.consultaId || undefined,
      paciente_id: state.pacienteId,
      paciente: personal,
      fecha_consulta: cab.fecha_consulta,
      hora: cab.hora,
      motivo_consulta: cab.motivo_consulta,
      antecedentes,
      gineco,
      examen_fisico: fisico,
      examen_ginecologico: gineExamen,
      diagnostico: diag.diagnostico,
      cie10: diag.cie10,
      tratamiento: diag.tratamiento,
      proxima_cita: diag.proxima_cita,
      notas: diag.notas,
      paraclinicos: leerParaclinicos(),
      imagenes: state.imagenes.map((i) => ({
        id: i.id, fecha: i.fecha, tipo: i.tipo, titulo: i.titulo, observaciones: i.observaciones,
      })),
      imagen_ids: state.imagenes.filter((i) => !i.consulta_id).map((i) => i.id),
    };
  }

  async function guardar() {
    const payload = armarPayload();
    if (!payload) return;

    const botones = [$('#btnGuardar'), $('#btnGuardar2')];
    botones.forEach((b) => { b.disabled = true; });

    try {
      const r = state.consultaId
        ? await App.api('historia.php', { method: 'PUT', body: payload })
        : await App.api('historia.php', { method: 'POST', body: payload });

      App.toast(state.consultaId ? 'Consulta actualizada' : 'Consulta registrada', 'ok');
      state.consultaId = r.consulta_id;

      const d = await App.api('historia.php', { params: { paciente: state.pacienteId } });
      state.historia = d.historia;
      state.consultas = d.consultas;
      state.paciente = d.paciente;
      state.imagenesPaciente = d.imagenes || [];
      state.ultimaCarga = r.consulta;
      cabeceraPaciente();

      await cargarConsulta(r.consulta_id, false);
      aviso(`Consulta N° ${r.consulta.numero} guardada correctamente.`);
      pintarTimeline();
    } catch (e) {
      App.toast(e.message, 'err');
    } finally {
      botones.forEach((b) => { b.disabled = false; });
    }
  }

  /* -------------------------- eventos -------------------------- */
  $('#btnGuardar').addEventListener('click', guardar);
  $('#btnGuardar2').addEventListener('click', guardar);
  $('#btnNueva').addEventListener('click', () => nuevaConsulta(true));
  $('#btnNueva2').addEventListener('click', () => nuevaConsulta(true));

  const imprimir = () => {
    if (!state.consultaId) { App.toast('Guarda la consulta antes de imprimir', 'err'); return; }
    window.open(`imprimir.html?c=${state.consultaId}`, '_blank');
  };
  $('#btnImprimir').addEventListener('click', imprimir);
  $('#btnImprimir2').addEventListener('click', imprimir);

  /* -------------------------- inicio -------------------------- */
  App.init({ pagina: 'pacientes' }).then(async () => {
    state.pacienteId = +(params.get('p') || 0);
    if (!state.pacienteId) {
      document.querySelector('main').innerHTML = App.vacio(
        'Paciente no especificado', 'Selecciona un paciente desde la lista.', 'pacientes'
      ) + '<div class="mt-14" style="text-align:center"><a class="btn btn-primary" href="pacientes.html">Ir a pacientes</a></div>';
      return;
    }
    try {
      await cargarContexto();
    } catch (e) {
      mostrarCarga(false);
      App.toast(e.message, 'err');
      aviso('No se pudo cargar la historia: ' + e.message, 'danger');
    }
  });
})();
