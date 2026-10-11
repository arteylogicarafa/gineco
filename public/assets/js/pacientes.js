/* pacientes.js */
(() => {
  const cuerpo = document.getElementById('cuerpo');
  const contador = document.getElementById('contador');
  const busqueda = document.getElementById('busqueda');
  const modal = document.getElementById('modalPaciente');
  const form = document.getElementById('formPaciente');
  const btnGuardar = document.getElementById('btnGuardar');

  const params = App.parametros();
  let q = params.get('q') || '';
  let pagina = 1;
  let editandoId = null;
  const POR_PAGINA = 15;

  busqueda.value = q;

  /* ----------------------------- listado ----------------------------- */
  async function cargar() {
    cuerpo.innerHTML = `<tr><td colspan="7">${App.cargando('Cargando pacientes...')}</td></tr>`;
    try {
      const d = await App.api('pacientes.php', { params: { q, page: pagina, limit: POR_PAGINA } });
      contador.textContent = d.total === 0
        ? (q ? `Sin resultados para "${q}"` : 'Aun no tienes pacientes registrados')
        : `${d.total} paciente${d.total === 1 ? '' : 's'}${q ? ` para "${q}"` : ''}`;

      if (!d.items.length) {
        cuerpo.innerHTML = `<tr><td colspan="7">${App.vacio(
          q ? 'Sin coincidencias' : 'Sin pacientes todavia',
          q ? 'Prueba con otro nombre o cedula.' : 'Registra tu primer paciente para abrir su historia clinica.',
          'pacientes'
        )}</td></tr>`;
      } else {
        cuerpo.innerHTML = d.items.map((p) => `
          <tr class="clickable" data-id="${p.id}">
            <td class="nowrap"><span class="badge rosa no-dot">${App.escapeHtml(p.registro_numero || '—')}</span></td>
            <td>
              <strong>${App.escapeHtml(p.nombre)}</strong>
              <div class="text-sm text-muted">${App.escapeHtml(p.cedula || 'Sin cedula')}${p.procedencia ? ' · ' + App.escapeHtml(p.procedencia) : ''}</div>
            </td>
            <td class="nowrap">${p.edad ? p.edad + ' años' : '—'}</td>
            <td class="nowrap">${App.escapeHtml(p.telefono || '—')}</td>
            <td class="nowrap">${p.ultima_consulta ? App.fecha(p.ultima_consulta) : '<span class="text-muted">Sin consultas</span>'}</td>
            <td class="nowrap">${p.proxima_cita ? `<span class="badge blue no-dot">${App.fecha(p.proxima_cita)}</span>` : '<span class="text-muted">—</span>'}</td>
            <td class="text-right nowrap">
              <button class="btn btn-soft btn-sm" data-abrir="${p.id}">Historia</button>
              <button class="btn btn-ghost btn-sm" data-editar="${p.id}" title="Editar">${App.icon('editar')}</button>
              <button class="btn btn-ghost btn-sm" data-eliminar="${p.id}" title="Eliminar" style="color:var(--danger)">${App.icon('basura')}</button>
            </td>
          </tr>`).join('');
      }

      App.paginar(d.total, d.page, POR_PAGINA, 'paginacion', (p) => { pagina = p; cargar(); });

      cuerpo.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          window.location.href = `historia.html?p=${tr.dataset.id}`;
        });
      });
      cuerpo.querySelectorAll('[data-abrir]').forEach((b) =>
        b.addEventListener('click', () => { window.location.href = `historia.html?p=${b.dataset.abrir}`; }));
      cuerpo.querySelectorAll('[data-editar]').forEach((b) =>
        b.addEventListener('click', () => abrirModal(+b.dataset.editar)));
      cuerpo.querySelectorAll('[data-eliminar]').forEach((b) =>
        b.addEventListener('click', () => eliminar(+b.dataset.eliminar)));
    } catch (err) {
      App.toast(err.message, 'err');
      cuerpo.innerHTML = `<tr><td colspan="7">${App.vacio('Error al cargar', err.message, 'pacientes')}</td></tr>`;
    }
  }

  /* ----------------------------- modal ----------------------------- */
  function abrirModal(id = null) {
    editandoId = id;
    form.reset();
    document.getElementById('tituloModal').textContent = id ? 'Editar paciente' : 'Nuevo paciente';
    document.getElementById('checkHistoria').style.display = id ? 'none' : 'inline-flex';
    App.pintarChecks(form);

    if (id) {
      App.api('pacientes.php', { params: { id } })
        .then((d) => {
          App.llenarForm(form, d.paciente);
          App.pintarChecks(form);
        })
        .catch((e) => App.toast(e.message, 'err'));
    }
    App.abrirModal('modalPaciente');
  }

  function cerrarModal() { App.cerrarModal(modal); }

  async function guardar() {
    const datos = App.leerForm(form);
    if (!datos.nombre || !datos.nombre.trim()) {
      App.toast('El nombre es obligatorio', 'err');
      form.elements.nombre.focus();
      return;
    }
    btnGuardar.disabled = true;
    try {
      if (editandoId) {
        datos.id = editandoId;
        await App.api('pacientes.php', { method: 'PUT', body: datos });
        App.toast('Paciente actualizado', 'ok');
      } else {
        const r = await App.api('pacientes.php', { method: 'POST', body: datos });
        App.toast('Paciente registrado', 'ok');
        if (r.historia) {
          window.location.href = `historia.html?p=${r.paciente.id}`;
          return;
        }
      }
      cerrarModal();
      cargar();
    } catch (err) {
      App.toast(err.message, 'err');
    } finally {
      btnGuardar.disabled = false;
    }
  }

  async function eliminar(id) {
    const ok = await App.confirmar('Se eliminara el paciente y su historia clinica (consultas, examenes e imagenes). Esta accion no se puede deshacer.', 'Eliminar paciente');
    if (!ok) return;
    try {
      await App.api('pacientes.php', { method: 'DELETE', params: { id } });
      App.toast('Paciente eliminado', 'ok');
      cargar();
    } catch (err) {
      App.toast(err.message, 'err');
    }
  }

  /* ----------------------------- eventos ----------------------------- */
  document.getElementById('btnNuevo').addEventListener('click', () => abrirModal());
  modal.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrarModal));
  btnGuardar.addEventListener('click', guardar);
  form.addEventListener('submit', (e) => { e.preventDefault(); guardar(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

  busqueda.addEventListener('input', App.debounce(() => {
    q = busqueda.value.trim();
    pagina = 1;
    const u = new URL(window.location);
    if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    history.replaceState(null, '', u);
    cargar();
  }, 280));

  // Edad automatica
  document.getElementById('fNac').addEventListener('change', (e) => {
    const a = App.edad(e.target.value);
    if (a !== null && a >= 0 && a < 130) document.getElementById('fEdad').value = a;
  });

  App.init({ pagina: 'pacientes' }).then(() => {
    cargar();
    if (params.get('nueva') === '1') abrirModal();
  });
})();
