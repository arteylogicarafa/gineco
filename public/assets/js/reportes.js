/* reportes.js */
(() => {
  const state = { tab: 'pacientes', desde: '', hasta: '' };
  const cuerpo = document.getElementById('cuerpoReporte');
  const pad = (n) => String(n).padStart(2, '0');

  function rangosPorDefecto() {
    const h = new Date();
    state.desde = `${h.getFullYear()}-${pad(h.getMonth() + 1)}-01`;
    state.hasta = `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate())}`;
    document.getElementById('desde').value = state.desde;
    document.getElementById('hasta').value = state.hasta;
  }

  function tabla(cols, filas) {
    if (!filas.length) {
      return App.vacio('Sin datos en el rango', 'Ajusta el rango de fechas o registra nuevos datos.', 'reportes');
    }
    return `<table class="table">
      <thead><tr>${cols.map((c) => `<th>${c.t}</th>`).join('')}</tr></thead>
      <tbody>${filas.join('')}</tbody>
    </table>`;
  }

  async function cargar() {
    cuerpo.innerHTML = App.cargando('Generando reporte...');
    try {
      const d = await App.api('reportes.php', {
        params: { tipo: state.tab, desde: state.desde, hasta: state.hasta },
      });
      const t = d.totales || {};

      if (state.tab === 'pacientes') {
        document.getElementById('tituloReporte').textContent = 'Lista de pacientes';
        document.getElementById('hintReporte').textContent = 'Todos los pacientes del medico con su ultima y proxima atencion';
        document.getElementById('badgeTotal').textContent = `${t.total || 0} pacientes`;
        cuerpo.innerHTML = tabla([
          { t: 'N° Registro' }, { t: 'Paciente' }, { t: 'CI' }, { t: 'Edad' },
          { t: 'Historia' }, { t: 'Consultas' }, { t: 'Ultima consulta' }, { t: 'Proxima cita' },
        ], (d.items || []).map((p) => `
          <tr class="clickable" onclick="window.location.href='historia.html?p=${p.id}'">
            <td><span class="badge rosa no-dot">${App.escapeHtml(p.registro_numero || '—')}</span></td>
            <td><strong>${App.escapeHtml(p.nombre)}</strong><div class="text-sm text-muted">${App.escapeHtml(p.telefono || '')}</div></td>
            <td>${App.escapeHtml(p.cedula || '—')}</td>
            <td>${p.edad ? p.edad + ' años' : '—'}</td>
            <td>${App.escapeHtml(p.historia || '—')}</td>
            <td class="num">${p.consultas || 0}</td>
            <td class="nowrap">${p.ultima_consulta ? App.fecha(p.ultima_consulta) : '—'}</td>
            <td class="nowrap">${p.proxima_cita ? App.fecha(p.proxima_cita) : '—'}</td>
          </tr>`));
      } else if (state.tab === 'citas') {
        document.getElementById('tituloReporte').textContent = 'Citas por rango de fechas';
        document.getElementById('hintReporte').textContent = `${App.fecha(d.desde)} — ${App.fecha(d.hasta)} · ${t.atendidas || 0} atendidas, ${t.pendientes || 0} pendientes, ${t.canceladas || 0} canceladas`;
        document.getElementById('badgeTotal').textContent = `${t.total || 0} citas`;
        cuerpo.innerHTML = tabla([
          { t: 'Fecha' }, { t: 'Hora' }, { t: 'Paciente' }, { t: 'Motivo' }, { t: 'Estado' },
        ], (d.items || []).map((c) => `
          <tr>
            <td class="nowrap">${App.fecha(c.fecha)}</td>
            <td class="nowrap">${App.hora(c.hora)}</td>
            <td><strong>${App.escapeHtml(c.paciente || '—')}</strong><div class="text-sm text-muted">${App.escapeHtml(c.cedula || '')}</div></td>
            <td>${App.escapeHtml(c.motivo || '—')}</td>
            <td><span class="badge ${c.estado === 'atendida' ? 'green' : c.estado === 'pendiente' ? 'amber' : 'gray'}">${c.estado}</span></td>
          </tr>`));
      } else if (state.tab === 'consultas') {
        document.getElementById('tituloReporte').textContent = 'Consultas del rango';
        document.getElementById('hintReporte').textContent = `${App.fecha(d.desde)} — ${App.fecha(d.hasta)}`;
        document.getElementById('badgeTotal').textContent = `${t.total || 0} consultas`;
        cuerpo.innerHTML = tabla([
          { t: 'Fecha' }, { t: 'Paciente' }, { t: 'N°' }, { t: 'Diagnostico' }, { t: 'CIE-10' },
        ], (d.items || []).map((c) => `
          <tr class="clickable" onclick="window.location.href='historia.html?p=${c.paciente_id}&c=${c.id}'">
            <td class="nowrap">${App.fecha(c.fecha_consulta)}</td>
            <td><strong>${App.escapeHtml(c.paciente || '—')}</strong><div class="text-sm text-muted">Reg. ${App.escapeHtml(c.registro_numero || '—')}</div></td>
            <td>${c.numero}</td>
            <td>${App.escapeHtml(c.diagnostico || '—')}</td>
            <td>${App.escapeHtml(c.cie10 || '—')}</td>
          </tr>`));
      } else {
        document.getElementById('tituloReporte').textContent = 'Resumen del periodo';
        document.getElementById('hintReporte').textContent = `${App.fecha(d.desde)} — ${App.fecha(d.hasta)}`;
        document.getElementById('badgeTotal').textContent = 'Indicadores';
        const estados = (d.por_estado || []);
        const diags = (d.diagnosticos || []);
        cuerpo.innerHTML = `
          <div class="card-pad">
            <div class="grid grid-2">
              <div>
                <h4 style="font-size:13.5px;margin-bottom:10px">Citas por estado</h4>
                ${estados.length ? `<table class="table"><tbody>
                  ${estados.map((e) => `<tr><td><span class="badge ${e.estado === 'atendida' ? 'green' : e.estado === 'pendiente' ? 'amber' : 'gray'}">${e.estado}</span></td><td class="num"><strong>${e.total}</strong></td></tr>`).join('')}
                </tbody></table>` : '<div class="text-muted">Sin citas en el rango</div>'}
              </div>
              <div>
                <h4 style="font-size:13.5px;margin-bottom:10px">Diagnosticos mas frecuentes</h4>
                ${diags.length ? `<table class="table"><tbody>
                  ${diags.map((x) => `<tr><td>${App.escapeHtml(x.diagnostico).slice(0, 60)}</td><td class="num"><strong>${x.total}</strong></td></tr>`).join('')}
                </tbody></table>` : '<div class="text-muted">Sin consultas en el rango</div>'}
              </div>
            </div>
          </div>`;
      }
    } catch (e) {
      App.toast(e.message, 'err');
      cuerpo.innerHTML = App.vacio('Error al generar el reporte', e.message, 'reportes');
    }
  }

  /* eventos */
  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.addEventListener('click', () => {
      state.tab = b.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach((x) => {
        x.classList.toggle('btn-soft', x === b);
        x.classList.toggle('btn-ghost', x !== b);
      });
      cargar();
    });
  });

  document.getElementById('btnAplicar').addEventListener('click', () => {
    state.desde = document.getElementById('desde').value || state.desde;
    state.hasta = document.getElementById('hasta').value || state.hasta;
    cargar();
  });

  document.querySelectorAll('[data-rango]').forEach((b) => {
    b.addEventListener('click', () => {
      const h = new Date();
      const tipo = b.dataset.rango;
      if (tipo === 'mes') {
        state.desde = `${h.getFullYear()}-${pad(h.getMonth() + 1)}-01`;
        state.hasta = `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate())}`;
      } else if (tipo === 'anio') {
        state.desde = `${h.getFullYear()}-01-01`;
        state.hasta = `${h.getFullYear()}-12-31`;
      } else {
        const f = new Date();
        f.setDate(f.getDate() - parseInt(tipo, 10));
        state.desde = `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
        state.hasta = App.hoy();
      }
      document.getElementById('desde').value = state.desde;
      document.getElementById('hasta').value = state.hasta;
      cargar();
    });
  });

  document.getElementById('btnImprimir').addEventListener('click', () => window.print());

  App.init({ pagina: 'reportes' }).then(() => {
    rangosPorDefecto();
    const tabInicial = App.parametros().get('tab');
    if (tabInicial) {
      state.tab = tabInicial;
      document.querySelectorAll('[data-tab]').forEach((x) => {
        x.classList.toggle('btn-soft', x.dataset.tab === tabInicial);
        x.classList.toggle('btn-ghost', x.dataset.tab !== tabInicial);
      });
    }
    cargar();
  });
})();
