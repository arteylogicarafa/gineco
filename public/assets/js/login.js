/* login.js */
(() => {
  const form = document.getElementById('loginForm');
  const cajaError = document.getElementById('errorBox');
  const btn = document.getElementById('btnEntrar');

  // Si ya tiene sesion, entra directo.
  App.api('session.php')
    .then((d) => { window.location.href = d.user.rol === 'superadmin' && !d.user.medico ? 'usuarios.html' : 'dashboard.html'; })
    .catch(() => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    cajaError.classList.add('hide');
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
      const data = await App.api('login.php', {
        method: 'POST',
        body: {
          usuario: document.getElementById('usuario').value.trim(),
          password: document.getElementById('password').value,
        },
      });
      const u = data.user;
      window.location.href = (u.rol === 'superadmin' && !u.medico) ? 'usuarios.html' : 'dashboard.html';
    } catch (err) {
      cajaError.className = '';
      cajaError.style.cssText = 'background:var(--danger-soft);color:var(--danger);border:1px solid rgba(197,34,31,.25);border-radius:10px;padding:11px 14px;font-size:13.5px;font-weight:600;margin-bottom:14px';
      cajaError.textContent = err.message || 'No se pudo iniciar sesion';
      btn.disabled = false;
      btn.textContent = 'Iniciar sesion';
    }
  });
})();
