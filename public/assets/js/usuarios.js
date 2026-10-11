/* usuarios.js - panel del superadmin */
(() => {
  const modal = document.getElementById('modalMedico');
  const form = document.getElementById('formMedico');
  let editandoId = null;

  async function cargar() {
    const cuerpo = document.getElementById('cuerpoMedicos');
    cuerpo.innerHTML = `<tr><td colspan="8">${App.cargando('Cargando cuentas...')}</td></tr>`;
    try {
      const d = await App.api('medicos.php', { params: { all: 1 } });
      document.getElementById('contadorMedicos').textContent = `${d.items.length} cuenta(s)`;

      if (!d.items.length) {
        cuerpo.innerHTML = `<tr><td colspan="8">${App.vacio('Sin medicos', 'Crea la primera cuenta de medico para comenzar.', 'usuarios')}</td></tr>`;
      } else {
        cuerpo.innerHTML = d.items.map((m) => `
          <tr>
            <td>
              <div class="flex gap-10 center">
                <div class="brand-logo" style="width:36px;height:36px;border-radius:10px;font-size:12px;background:${App.escapeHtml(m.color_primario || '#C2185B')}">
                  ${m.logo_url ? `<img src="${App.escapeHtml(m.logo_url)}" alt="">` : App.escapeHtml(m.monograma || App.iniciales(m.nombre))}
                </div>
                <div>
                  <strong>${App.escapeHtml(m.nombre)}</strong>
                  <div class="text-sm text-muted">${App.escapeHtml(m.telefono || m.correo || '')}</div>
                </div>
              </div>
            </td>
            <td class="nowrap">${App.escapeHtml(m.usuario)}</td>
            <td>${App.escapeHtml(m.especialidad || '—')}</td>
            <td class="num">${m.pacientes}</td>
            <td class="num">${m.citas}</td>
            <td><span class="badge ${m.activo ? 'green' : 'red'}">${m.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td class="nowrap">${m.ultimo_acceso ? new Date(m.ultimo_acceso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '<span class="text-muted">Nunca</span>'}</td>
            <td class="text-right nowrap">
              <button class="btn btn-soft btn-sm" data-editar="${m.id}">Editar</button>
              <button class="btn btn-ghost btn-sm" data-toggle="${m.id}">${m.activo ? 'Desactivar' : 'Activar'}</button>
              <button class="btn btn-ghost btn-sm" data-eliminar="${m.id}" style="color:var(--danger)" title="Eliminar">${App.icon('basura')}</button>
            </td>
          </tr>`).join('');
      }

      cuerpo.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => abrir(+b.dataset.editar, d.items)));
      cuerpo.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggle(+b.dataset.toggle)));
      cuerpo.querySelectorAll('[data-eliminar]').forEach((b) => b.addEventListener('click', () => eliminar(+b.dataset.eliminar)));

      const admins = d.admins || [];
      document.getElementById('cuerpoAdmins').innerHTML = admins.length
        ? admins.map((a) => `<tr>
            <td><strong>${App.escapeHtml(a.nombre)}</strong></td>
            <td>${App.escapeHtml(a.usuario)}</td>
            <td>${App.escapeHtml(a.email || '—')}</td>
            <td class="nowrap">${a.ultimo_acceso ? new Date(a.ultimo_acceso).toLocaleString('es-EC') : '—'}</td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="text-muted">Sin administradores</td></tr>';
    } catch (e) {
      App.toast(e.message, 'err');
      cuerpo.innerHTML = `<tr><td colspan="8">${App.vacio('Error', e.message, 'usuarios')}</td></tr>`;
    }
  }

  function abrir(id = null, lista = []) {
    editandoId = id;
    form.reset();
    document.getElementById('tituloModalMedico').textContent = id ? 'Editar medico' : 'Nuevo medico';
    document.getElementById('btnGuardarMedico').textContent = id ? 'Guardar cambios' : 'Crear cuenta';
    document.getElementById('fUsuario').disabled = !!id;
    document.getElementById('fPassword').parentElement.classList.toggle('hide', !!id);
    document.getElementById('avisoPassword').classList.add('hide');

    if (id) {
      const m = lista.find((x) => x.id === id);
      if (m) {
        const el = (n) => form.elements[n];
        el('nombre').value = m.nombre || '';
        el('usuario').value = m.usuario || '';
        el('especialidad').value = m.especialidad || '';
        el('colegiatura').value = m.colegiatura || '';
        el('email').value = m.correo || m.email || '';
        el('telefono').value = m.telefono || '';
        el('direccion').value = m.direccion || '';
        el('color_primario').value = m.color_primario || '#C2185B';
        el('monograma').value = m.monograma || '';
      }
    }
    App.abrirModal('modalMedico');
  }

  async function guardar() {
    const datos = App.leerForm(form);
    if (!datos.nombre || !datos.nombre.trim()) { App.toast('El nombre es obligatorio', 'err'); return; }

    const btn = document.getElementById('btnGuardarMedico');
    btn.disabled = true;
    try {
      if (editandoId) {
        datos.id = editandoId;
        await App.api('medicos.php', { method: 'PUT', body: datos });
        App.toast('Cuenta actualizada', 'ok');
      } else {
        if (!datos.usuario) { App.toast('Indica un usuario', 'err'); return; }
        if (!datos.password || datos.password.length < 6) { App.toast('La contrasena debe tener al menos 6 caracteres', 'err'); return; }
        await App.api('medicos.php', { method: 'POST', body: datos });
        App.toast('Cuenta de medico creada', 'ok');
      }
      App.cerrarModal(modal);
      cargar();
    } catch (e) {
      App.toast(e.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function toggle(id) {
    try {
      const r = await App.api('medicos.php', { method: 'DELETE', params: { id } });
      App.toast(r.activo ? 'Cuenta activada' : 'Cuenta desactivada', 'ok');
      cargar();
    } catch (e) { App.toast(e.message, 'err'); }
  }

  async function eliminar(id) {
    const ok = await App.confirmar('Se eliminara la cuenta, su perfil medico y todos sus pacientes, historias y citas. Esta accion no se puede deshacer.', 'Eliminar medico');
    if (!ok) return;
    try {
      await App.api('medicos.php', { method: 'DELETE', params: { id, accion: 'eliminar' } });
      App.toast('Cuenta eliminada', 'ok');
      cargar();
    } catch (e) { App.toast(e.message, 'err'); }
  }

  document.getElementById('btnNuevoMedico').addEventListener('click', () => abrir());
  document.getElementById('btnGuardarMedico').addEventListener('click', guardar);
  form.addEventListener('submit', (e) => { e.preventDefault(); guardar(); });
  modal.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => App.cerrarModal(modal)));
  modal.addEventListener('click', (e) => { if (e.target === modal) App.cerrarModal(modal); });

  // Sugerir usuario a partir del nombre
  form.elements.nombre.addEventListener('input', () => {
    if (editandoId) return;
    const u = form.elements.nombre.value.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\s]/g, '').trim().split(/\s+/).slice(0, 2).join('.');
    if (u && !form.elements.usuario.dataset.tocado) form.elements.usuario.value = u;
  });
  form.elements.usuario.addEventListener('input', () => { form.elements.usuario.dataset.tocado = '1'; });

  App.init({ pagina: 'usuarios' }).then((u) => {
    if (!u || u.rol !== 'superadmin') {
      document.querySelector('main').innerHTML = App.vacio(
        'Acceso restringido', 'Esta seccion es solo para administradores del sistema.', 'shield'
      );
      return;
    }
    cargar();
  });
})();
