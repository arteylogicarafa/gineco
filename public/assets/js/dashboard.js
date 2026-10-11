/* dashboard.js */
(() => {
  const badgeEstado = (e) => {
    const mapa = { pendiente: 'amber', atendida: 'green', cancelada: 'gray' };
    return `<span class="badge ${mapa[e] || 'gray'}">${App.escapeHtml(e || '')}</span>`;
  };

  function tarjeta(num, lbl, ic, clase = '') {
    return `<div class="kpi">
        <div class="ico ${clase}">${App.icon(ic)}</div>
        <div>
          <div class="num">${num}</div>
          <div class="lbl">${App.escapeHtml(lbl)}</div>
        </div>
      </div>`;
  }

  function pintarCitas(items, cont, vacioTxt) {
    if (!items.length) {
      cont.innerHTML = App.vacio(vacioTxt, 'No hay citas registradas en este periodo.', 'citas');
      return;
    }
    cont.innerHTML = items.map((c) => `
      <div class="list-item" data-cita="${c.id}">
        <div class="when">${c.fecha ? App.fecha(c.fecha, true) : ''}<br>${App.hora(c.hora)}</div>
        <div class="grow">
          <strong>${App.escapeHtml(c.paciente_nombre || 'Paciente no registrado')}</strong>
          <span>${App.escapeHtml(c.motivo || 'Sin motivo registrado')}</span>
        </div>
        ${badgeEstado(c.estado)}
        ${c.estado === 'pendiente' ? `<button class="btn btn-ghost btn-sm" data-atender="${c.id}">Atender</button>` : ''}
      </div>`).join('');

    cont.querySelectorAll('[data-atender]').forEach((b) => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await App.api('citas.php', { method: 'PUT', body: { id: +b.dataset.atender, estado: 'atendida' } });
          App.toast('Cita marcada como atendida', 'ok');
          cargar();
        } catch (err) { App.toast(err.message, 'err'); }
      });
    });
  }

  async function cargar() {
    try {
      const d = await App.api('dashboard.php');
      const s = d.stats;

      document.getElementById('kpis').innerHTML = [
        tarjeta(s.pacientes, 'Pacientes activos', 'pacientes'),
        tarjeta(s.citas_hoy, 'Citas de hoy', 'citas', 'blue'),
        tarjeta(s.citas_pendientes, 'Citas pendientes', 'reloj', 'amber'),
        tarjeta(s.consultas_mes, 'Consultas del mes', 'historia', 'green'),
      ].join('');

      const f = new Date(d.hoy + 'T12:00:00');
      document.getElementById('fechaHoy').textContent = f.toLocaleDateString('es-EC', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });

      pintarCitas(d.citas_hoy, document.getElementById('citasHoy'), 'Sin citas para hoy');
      pintarCitas(d.proximas_citas, document.getElementById('proximas'), 'Sin proximas citas');

      const cuerpo = document.getElementById('ultimasConsultas');
      if (!d.ultimas_consultas.length) {
        cuerpo.innerHTML = `<tr><td colspan="3">${App.vacio('Sin consultas todavia', 'Registra la primera historia clinica.', 'historia')}</td></tr>`;
      } else {
        cuerpo.innerHTML = d.ultimas_consultas.map((c) => `
          <tr class="clickable" onclick="window.location.href='historia.html?p=${c.paciente_id}&c=${c.id}'">
            <td>
              <strong>${App.escapeHtml(c.paciente_nombre)}</strong>
              <div class="text-sm text-muted">N° ${App.escapeHtml(c.registro_numero || '—')} · Consulta ${c.numero}</div>
            </td>
            <td class="nowrap">${App.fecha(c.fecha_consulta)}</td>
            <td>${App.escapeHtml((c.diagnostico || c.motivo_consulta || '—')).slice(0, 70)}</td>
          </tr>`).join('');
      }

      document.getElementById('indicadores').innerHTML = `
        <div><div class="k">Pacientes nuevos (mes)</div><div class="v">${s.pacientes_nuevos}</div></div>
        <div><div class="k">Historias abiertas</div><div class="v">${s.historias}</div></div>`;
    } catch (err) {
      App.toast(err.message, 'err');
    }
  }

  App.init({ pagina: 'dashboard' }).then(cargar);
})();
