/* perfil.js */
(() => {
  let logoBase64 = null;
  let quitarLogo = false;
  let medicoActual = null;

  const PALETAS = [
    ['#C2185B', '#F06292', 'Rosa institucional'],
    ['#AD1457', '#EC407A', 'Rosa profundo'],
    ['#8E24AA', '#CE93D8', 'Lila'],
    ['#00838F', '#4DD0E1', 'Turquesa'],
    ['#2E7D32', '#81C784', 'Verde clinico'],
    ['#1565C0', '#64B5F6', 'Azul'],
    ['#455A64', '#90A4AE', 'Gris elegante'],
    ['#6A1B9A', '#BA68C8', 'Ultravioleta'],
  ];

  function pintarLogo(url) {
    const cont = document.getElementById('previewLogo');
    if (url) {
      cont.innerHTML = `<img src="${url}" alt="logo" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      cont.textContent = (medicoActual && medicoActual.monograma) || App.iniciales(medicoActual?.nombre || 'HG');
    }
  }

  function aplicarColores() {
    const prim = document.getElementById('fColor').value;
    const seg = document.getElementById('fColor2').value;
    const r = parseInt(prim.slice(1, 3), 16);
    const g = parseInt(prim.slice(3, 5), 16);
    const b = parseInt(prim.slice(5, 7), 16);
    const s = document.documentElement.style;
    s.setProperty('--primary', prim);
    s.setProperty('--primary-dark', `rgb(${Math.round(r * .82)}, ${Math.round(g * .82)}, ${Math.round(b * .82)})`);
    s.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    s.setProperty('--primary-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);
    s.setProperty('--primary-softer', `rgba(${r}, ${g}, ${b}, 0.05)`);
    document.querySelector('.brand-logo').style.background = `linear-gradient(135deg, ${prim}, ${seg})`;
  }

  function cargarPerfil(medico) {
    medicoActual = medico;
    if (!medico) {
      document.querySelector('main').innerHTML = App.vacio(
        'Sin perfil medico', 'Tu cuenta no tiene perfil medico asociado. Contacta al administrador.', 'usuarios'
      );
      return false;
    }
    document.getElementById('fNombre').value = medico.nombre || '';
    document.getElementById('fEspecialidad').value = medico.especialidad || '';
    document.getElementById('fColegiatura').value = medico.colegiatura || '';
    document.getElementById('fDireccion').value = medico.direccion || '';
    document.getElementById('fTelefono').value = medico.telefono || '';
    document.getElementById('fCorreo').value = medico.correo || '';
    document.getElementById('fColor').value = medico.color_primario || '#C2185B';
    document.getElementById('fColor2').value = medico.color_secundario || '#F06292';
    document.getElementById('fMonograma').value = medico.monograma || '';
    pintarLogo(medico.logo_url);
    aplicarColores();
    return true;
  }

  function leerFormulario() {
    return {
      nombre: document.getElementById('fNombre').value.trim(),
      especialidad: document.getElementById('fEspecialidad').value.trim(),
      colegiatura: document.getElementById('fColegiatura').value.trim(),
      direccion: document.getElementById('fDireccion').value.trim(),
      telefono: document.getElementById('fTelefono').value.trim(),
      correo: document.getElementById('fCorreo').value.trim(),
      color_primario: document.getElementById('fColor').value,
      color_secundario: document.getElementById('fColor2').value,
      monograma: document.getElementById('fMonograma').value.trim(),
    };
  }

  async function guardar() {
    const datos = leerFormulario();
    if (!datos.nombre) { App.toast('El nombre es obligatorio', 'err'); return; }
    if (logoBase64) datos.logo = logoBase64;
    if (quitarLogo) datos.quitar_logo = 1;

    try {
      const r = await App.api('medicos.php', { method: 'PUT', body: datos });
      medicoActual = r.medico;
      logoBase64 = null;
      quitarLogo = false;
      pintarLogo(r.medico.logo_url);
      App.toast('Perfil actualizado', 'ok');
      // recarga la sesion para refrescar el sidebar con los nuevos colores
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      App.toast(e.message, 'err');
    }
  }

  /* eventos */
  document.getElementById('btnGuardarPerfil').addEventListener('click', guardar);

  document.getElementById('btnLogo').addEventListener('click', () => document.getElementById('inputLogo').click());
  document.getElementById('inputLogo').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { App.toast('El logo no puede superar 3 MB', 'err'); return; }
    const lector = new FileReader();
    lector.onload = () => {
      logoBase64 = lector.result;
      quitarLogo = false;
      const cont = document.getElementById('previewLogo');
      cont.innerHTML = `<img src="${logoBase64}" alt="logo" style="width:100%;height:100%;object-fit:cover">`;
      App.toast('Logo listo, guarda los cambios', 'ok');
    };
    lector.readAsDataURL(f);
  });

  document.getElementById('btnQuitarLogo').addEventListener('click', () => {
    logoBase64 = null;
    quitarLogo = true;
    pintarLogo(null);
  });

  document.getElementById('fColor').addEventListener('input', aplicarColores);
  document.getElementById('fColor2').addEventListener('input', aplicarColores);

  document.getElementById('paletas').innerHTML = PALETAS.map(([a, b, n], i) => `
    <button class="btn btn-ghost btn-sm" data-p="${i}" title="${n}" style="gap:5px">
      <span style="width:14px;height:14px;border-radius:4px;background:${a};display:inline-block"></span>
      <span style="width:14px;height:14px;border-radius:4px;background:${b};display:inline-block"></span>
      <span>${n}</span>
    </button>`).join('');

  document.querySelectorAll('[data-p]').forEach((b) => {
    b.addEventListener('click', () => {
      const [a, c] = PALETAS[+b.dataset.p];
      document.getElementById('fColor').value = a;
      document.getElementById('fColor2').value = c;
      aplicarColores();
    });
  });

  document.getElementById('btnPassword').addEventListener('click', async () => {
    const actual = document.getElementById('pActual').value;
    const nueva = document.getElementById('pNueva').value;
    const repetir = document.getElementById('pRepetir').value;
    if (nueva.length < 6) { App.toast('La nueva contrasena debe tener al menos 6 caracteres', 'err'); return; }
    if (nueva !== repetir) { App.toast('Las contrasenas no coinciden', 'err'); return; }
    try {
      await App.api('medicos.php', { method: 'PUT', body: { accion: 'password', password_actual: actual, password_nueva: nueva } });
      App.toast('Contrasena actualizada', 'ok');
      document.getElementById('pActual').value = '';
      document.getElementById('pNueva').value = '';
      document.getElementById('pRepetir').value = '';
    } catch (e) {
      App.toast(e.message, 'err');
    }
  });

  App.init({ pagina: 'perfil' }).then((u) => {
    if (u) cargarPerfil(u.medico);
  });
})();
