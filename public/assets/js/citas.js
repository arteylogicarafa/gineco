/* citas.js - calendario mensual/semanal + vista del dia */
(() => {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

  const state = {
    anio: new Date().getFullYear(),
    mes: new Date().getMonth(),
    vista: 'mes',
    fechaSel: App.hoy(),
    citas: [],
    pacientes: [],
    editandoId: null,
  };

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const inicioSemana = (fecha) => {
    const d = new Date(fecha + 'T12:00:00');
    const dif = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dif);
    return d;
  };

  /* ----------------------------- datos ----------------------------- */
  async function cargarCitas() {
    let desde;
    let hasta;
    if (state.vista === 'semana') {
      const i = inicioSemana(state.fechaSel);
      const f = new Date(i);
      f.setDate(f.getDate() + 6);
      desde = `${i.getFullYear()}-${pad(i.getMonth() + 1)}-${pad(i.getDate())}`;
      hasta = `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
      state.anio = f.getFullYear();
      state.mes = f.getMonth();
    } else {
      desde = iso(state.anio, state.mes, 1);
      const ultimo = new Date(state.anio, state.mes + 1, 0).getDate();
      hasta = iso(state.anio, state.mes, ultimo);
    }
    const d = await App.api('citas.php', { params: { desde, hasta } });
    state.citas = d.items || [];
  }

  async function cargarPacientes() {
    try {
      const d = await App.api('pacientes.php', { params: { limit: 500 } });
      state.pacientes = d.items || [];
      const sel = document.getElementById('selPaciente');
      sel.innerHTML = '<option value="">-- Paciente registrado --</option>' +
        state.pacientes.map((p) => `<option value="${p.id}">${App.escapeHtml(p.nombre)}${p.cedula ? ' · ' + App.escapeHtml(p.cedula) : ''}</option>`).join('') +
        '<option value="__otro__">Otro / no registrado</option>';
    } catch (e) { /* listado opcional */ }
  }

  const badge = (e) => {
    const mapa = { pendiente: 'amber', atendida: 'green', cancelada: 'gray' };
    return `<span class="badge ${mapa[e] || 'gray'}">${e}</span>`;
  };

  /* ----------------------------- calendario ----------------------------- */
  function pintarCalendario() {
    document.getElementById('tituloCal').textContent =
      state.vista === 'semana'
        ? `Semana del ${state.fechaSel.split('-').reverse().join('/')}`
        : `${MESES[state.mes]} ${state.anio}`;

    const totalCitas = state.citas.length;
    document.getElementById('resumenMes').textContent =
      `${totalCitas} cita${totalCitas === 1 ? '' : 's'} en el periodo`;

    const cont = document.getElementById('calendario');
    const cabecera = DIAS.map((d) => `<div class="cal-dow">${d}</div>`).join('');

    let celdas = [];
    if (state.vista === 'semana') {
      const i = inicioSemana(state.fechaSel);
      for (let k = 0; k < 7; k++) {
        const f = new Date(i);
        f.setDate(f.getDate() + k);
        celdas.push({ fecha: iso(f.getFullYear(), f.getMonth(), f.getDate()), dia: f.getDate(), fuera: f.getMonth() !== state.mes });
      }
    } else {
      const primero = new Date(state.anio, state.mes, 1);
      const dias = new Date(state.anio, state.mes + 1, 0).getDate();
      const inicioDow = (primero.getDay() + 6) % 7;
      const celdasTotales = Math.ceil((inicioDow + dias) / 7) * 7;
      const previo = new Date(state.anio, state.mes, 1 - inicioDow);
      for (let k = 0; k < celdasTotales; k++) {
        const f = new Date(previo);
        f.setDate(previo.getDate() + k);
        celdas.push({
          fecha: iso(f.getFullYear(), f.getMonth(), f.getDate()),
          dia: f.getDate(),
          fuera: f.getMonth() !== state.mes,
        });
      }
    }

    const html = celdas.map((c) => {
      const delDia = state.citas.filter((x) => x.fecha === c.fecha);
      const eventos = delDia.slice(0, 3).map((x) => {
        const cls = x.estado === 'atendida' ? 'green' : (x.estado === 'cancelada' ? 'gray' : '');
        return `<div class="cal-ev ${cls}" title="${App.escapeHtml(x.paciente_nombre || '')}">${App.hora(x.hora)} ${App.escapeHtml((x.paciente_nombre || x.paciente_txt || 'Cita').split(' ')[0])}</div>`;
      }).join('');
      const mas = delDia.length > 3 ? `<div class="cal-more">+${delDia.length - 3} mas</div>` : '';
      const clases = [
        'cal-day',
        c.fuera ? 'out' : '',
        c.fecha === state.fechaSel ? 'sel' : '',
        c.fecha === App.hoy() ? 'today' : '',
      ].join(' ');
      return `<div class="${clases}" data-fecha="${c.fecha}"><div class="d-num">${c.dia}</div>${eventos}${mas}</div>`;
    }).join('');

    cont.className = 'cal' + (state.vista === 'semana' ? ' week' : '');
    cont.innerHTML = cabecera + html;

    cont.querySelectorAll('.cal-day').forEach((el) => {
      el.addEventListener('click', () => {
        state.fechaSel = el.dataset.fecha;
        const [y, m] = state.fechaSel.split('-').map(Number);
        state.anio = y;
        state.mes = m - 1;
        pintarCalendario();
        pintarDia();
      });
    });
  }

  function pintarDia() {
    const f = new Date(state.fechaSel + 'T12:00:00');
    document.getElementById('tituloDia').textContent =
      state.fechaSel === App.hoy() ? 'Citas de hoy' : f.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('subtituloDia').textContent =
      `${state.citas.filter((c) => c.fecha === state.fechaSel).length} cita(s) programadas`;

    const delDia = state.citas.filter((c) => c.fecha === state.fechaSel).sort((a, b) => a.hora.localeCompare(b.hora));
    const cont = document.getElementById('listaDia');

    if (!delDia.length) {
      cont.innerHTML = App.vacio('Dia libre', 'No hay citas para esta fecha. Puedes agendar una.', 'citas');
      return;
    }

    cont.innerHTML = delDia.map((c) => `
      <div class="list-item" data-cita="${c.id}">
        <div class="when">${App.hora(c.hora)}</div>
        <div class="grow">
          <strong>${App.escapeHtml(c.paciente_nombre || 'No registrado')}</strong>
          <span>${App.escapeHtml(c.motivo || 'Sin motivo')}</span>
        </div>
        <div class="flex gap-6" style="flex-direction:column;align-items:flex-end">
          ${badge(c.estado)}
          <div class="flex gap-6">
            ${c.estado === 'pendiente' ? `<button class="btn btn-soft btn-sm" data-acc="atender" data-id="${c.id}">Atender</button>` : ''}
            ${c.estado === 'pendiente' ? `<button class="btn btn-ghost btn-sm" data-acc="cancelar" data-id="${c.id}">Cancelar</button>` : ''}
            <button class="btn btn-ghost btn-sm" data-acc="editar" data-id="${c.id}">${App.icon('editar')}</button>
          </div>
        </div>
      </div>`).join('');

    cont.querySelectorAll('[data-acc]').forEach((b) => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = +b.dataset.id;
        const cita = state.citas.find((x) => x.id === id);
        if (!cita) return;
        try {
          if (b.dataset.acc === 'atender') {
            await App.api('citas.php', { method: 'PUT', body: { id, estado: 'atendida' } });
            App.toast('Cita atendida', 'ok');
            await refrescar();
          } else if (b.dataset.acc === 'cancelar') {
            await App.api('citas.php', { method: 'PUT', body: { id, estado: 'cancelada' } });
            App.toast('Cita cancelada', 'ok');
            await refrescar();
          } else {
            abrirModal(cita);
          }
        } catch (err) { App.toast(err.message, 'err'); }
      });
    });
    cont.querySelectorAll('[data-cita]').forEach((el) => {
      el.addEventListener('dblclick', () => {
        const cita = state.citas.find((x) => x.id === +el.dataset.cita);
        if (cita) abrirModal(cita);
      });
    });
  }

  async function refrescar() {
    await cargarCitas();
    pintarCalendario();
    pintarDia();
  }

  /* ----------------------------- modal ----------------------------- */
  const modal = document.getElementById('modalCita');
  const form = document.getElementById('formCita');

  function abrirModal(cita = null) {
    form.reset();
    state.editandoId = cita ? cita.id : null;
    document.getElementById('tituloModalCita').textContent = cita ? 'Editar cita' : 'Nueva cita';
    document.getElementById('btnEliminarCita').style.display = cita ? 'inline-flex' : 'none';

    const el = (n) => form.elements[n];
    el('fecha').value = cita ? cita.fecha : state.fechaSel;
    el('hora').value = cita ? App.hora(cita.hora) : '09:00';
    el('motivo').value = cita ? (cita.motivo || '') : '';
    el('notas').value = cita ? (cita.notas || '') : '';
    el('estado').value = cita ? cita.estado : 'pendiente';

    const conPaciente = cita && cita.paciente_id;
    el('paciente_id').value = conPaciente ? String(cita.paciente_id) : (cita ? '__otro__' : '');
    document.getElementById('campoTxt').classList.toggle('hide', !!conPaciente || !cita);
    el('paciente_txt').value = cita && !cita.paciente_id ? (cita.paciente_nombre || '') : '';

    App.abrirModal('modalCita');
  }

  function cerrarModal() { App.cerrarModal(modal); }

  async function guardarCita() {
    const datos = App.leerForm(form);
    if (!datos.fecha || !datos.hora) { App.toast('Fecha y hora son obligatorias', 'err'); return; }
    const esOtro = datos.paciente_id === '__otro__' || datos.paciente_id === '';
    if (esOtro && !((datos.paciente_txt || '').trim())) {
      App.toast('Selecciona un paciente o escribe su nombre', 'err');
      return;
    }

    const body = {
      id: state.editandoId || undefined,
      fecha: datos.fecha,
      hora: datos.hora,
      motivo: datos.motivo,
      notas: datos.notas,
      estado: datos.estado,
      paciente_id: esOtro ? null : +datos.paciente_id,
      paciente_txt: esOtro ? datos.paciente_txt : null,
    };

    try {
      if (state.editandoId) {
        await App.api('citas.php', { method: 'PUT', body });
        App.toast('Cita actualizada', 'ok');
      } else {
        await App.api('citas.php', { method: 'POST', body });
        App.toast('Cita agendada', 'ok');
      }
      cerrarModal();
      const [y, m] = body.fecha.split('-').map(Number);
      state.fechaSel = body.fecha;
      state.anio = y;
      state.mes = m - 1;
      await refrescar();
    } catch (e) {
      App.toast(e.message, 'err');
    }
  }

  async function eliminarCita() {
    if (!state.editandoId) return;
    const ok = await App.confirmar('Eliminar esta cita de la agenda?', 'Eliminar cita');
    if (!ok) return;
    try {
      await App.api('citas.php', { method: 'DELETE', params: { id: state.editandoId } });
      App.toast('Cita eliminada', 'ok');
      cerrarModal();
      await refrescar();
    } catch (e) { App.toast(e.message, 'err'); }
  }

  /* ----------------------------- eventos ----------------------------- */
  document.getElementById('btnNuevaCita').addEventListener('click', () => abrirModal());
  document.getElementById('btnCitaDia').addEventListener('click', () => abrirModal());
  modal.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrarModal));
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
  document.getElementById('btnGuardarCita').addEventListener('click', guardarCita);
  document.getElementById('btnEliminarCita').addEventListener('click', eliminarCita);
  form.addEventListener('submit', (e) => { e.preventDefault(); guardarCita(); });

  form.elements.paciente_id.addEventListener('change', () => {
    document.getElementById('campoTxt').classList.toggle('hide', form.elements.paciente_id.value !== '__otro__');
  });

  document.getElementById('btnAnterior').addEventListener('click', async () => {
    if (state.vista === 'semana') {
      const f = new Date(state.fechaSel + 'T12:00:00');
      f.setDate(f.getDate() - 7);
      state.fechaSel = `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
    } else {
      state.mes--;
      if (state.mes < 0) { state.mes = 11; state.anio--; }
    }
    await refrescar();
  });

  document.getElementById('btnSiguiente').addEventListener('click', async () => {
    if (state.vista === 'semana') {
      const f = new Date(state.fechaSel + 'T12:00:00');
      f.setDate(f.getDate() + 7);
      state.fechaSel = `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
    } else {
      state.mes++;
      if (state.mes > 11) { state.mes = 0; state.anio++; }
    }
    await refrescar();
  });

  document.getElementById('btnHoy').addEventListener('click', async () => {
    const h = new Date();
    state.fechaSel = App.hoy();
    state.anio = h.getFullYear();
    state.mes = h.getMonth();
    await refrescar();
  });

  document.querySelectorAll('[data-vista]').forEach((b) => {
    b.addEventListener('click', async () => {
      state.vista = b.dataset.vista;
      document.querySelectorAll('[data-vista]').forEach((x) => {
        x.classList.toggle('btn-soft', x === b);
        x.classList.toggle('btn-ghost', x !== b);
      });
      await refrescar();
    });
  });

  /* ----------------------------- inicio ----------------------------- */
  App.init({ pagina: 'citas' }).then(async () => {
    await cargarPacientes();
    await refrescar();
    if (App.parametros().get('nueva') === '1') abrirModal();
  });
})();
