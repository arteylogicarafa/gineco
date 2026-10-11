/* imprimir.js - documento listo para imprimir / exportar a PDF */
(() => {
  const params = App.parametros();
  const consultaId = +(params.get('c') || 0);
  const hoja = document.getElementById('hoja');

  const esc = (v) => App.escapeHtml(v === null || v === undefined || v === '' ? '' : v);
  const val = (v) => (v === null || v === undefined || String(v).trim() === '' ? '—' : esc(v));
  const si = (v) => (v === true || v === 't' || v === '1' || v === 1 ? 'Si' : 'No');

  function item(k, v, cls = '') {
    return `<div class="${cls}"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
  }

  function bloque(n, titulo, contenido) {
    return `<section class="doc-sec"><h2><span>${n}</span>${esc(titulo)}</h2>${contenido}</section>`;
  }

  function render(d) {
    const c = d.consulta;
    const m = d.medico;
    const p = c;

    const logo = m.logo_url
      ? `<div class="doc-logo"><img src="${esc(m.logo_url)}" alt=""></div>`
      : `<div class="doc-logo">${esc(m.monograma || App.iniciales(m.nombre))}</div>`;

    const cabecera = `
      <header class="doc-head">
        ${logo}
        <div style="flex:1">
          <h1>${esc(m.nombre)}</h1>
          <div class="esp">${esc(m.especialidad || '')}</div>
          <div class="dato">${esc(m.direccion || '')}${m.telefono ? ' · ' + esc(m.telefono) : ''}${m.correo ? ' · ' + esc(m.correo) : ''}</div>
          ${m.colegiatura ? `<div class="dato">${esc(m.colegiatura)}</div>` : ''}
        </div>
      </header>

      <div class="doc-meta">
        <div><b>N° Historia:</b> ${val(c.historia_numero || p.registro_numero)}</div>
        <div><b>Consulta N°:</b> ${esc(c.numero)}</div>
        <div><b>Fecha:</b> ${App.fecha(c.fecha_consulta)} ${App.hora(c.hora)}</div>
        <div><b>Paciente:</b> ${val(p.paciente_nombre)}</div>
        <div><b>C.I.:</b> ${val(p.paciente_cedula)}</div>
        <div><b>Edad:</b> ${p.edad ? esc(p.edad) + ' años' : '—'}</div>
        <div><b>Sexo:</b> ${val(p.sexo)}</div>
      </div>`;

    const sec1 = `<div class="dl2">
      ${item('Nombre completo', val(p.paciente_nombre))}
      ${item('Edad', p.edad ? esc(p.edad) + ' años' : '—')}
      ${item('Sexo', val(p.sexo))}
      ${item('Fecha de nacimiento', p.fecha_nacimiento ? App.fecha(p.fecha_nacimiento) : '—')}
      ${item('Cedula / ID', val(p.paciente_cedula))}
      ${item('Telefono', val(p.telefono))}
      ${item('N° Registro', val(p.registro_numero))}
      ${item('Procedencia', val(p.procedencia))}
      ${item('Ocupacion', val(p.ocupacion))}
      ${item('Estado civil', val(p.estado_civil))}
      ${item('Correo', val(p.correo))}
      ${item('Direccion', val(p.direccion))}
      ${item('Alergias conocidas', val(p.alergias_conocidas), 'full')}
      ${item('Motivo de consulta', val(c.motivo_consulta), 'full')}
    </div>`;

    const ant = c.antecedentes || {};
    const sec2 = `
      <div class="dl2">
        ${item('HTA', si(ant.hta))}
        ${item('Diabetes mellitus', val(ant.dm))}
        ${item('Tiroides', ant.tiroides ? 'Si' + (ant.tiroides_detalle ? ' · ' + esc(ant.tiroides_detalle) : '') : 'No')}
        ${item('Asma', si(ant.asma))}
        ${item('Insulina', si(ant.insulina))}
        ${item('Alergias', ant.alergia ? 'Si' + (ant.alergia_detalle ? ' · ' + esc(ant.alergia_detalle) : '') : 'No')}
        ${item('Fumador', val(ant.fumador))}
        ${item('Alcohol', val(ant.alcohol))}
        ${item('ITS previa', val(ant.ITS))}
        ${item('Quirurgicos', val(ant.quirurgicos), 'full')}
        ${item('Otros antecedentes', val(ant.otros), 'full')}
        ${item('Antecedentes familiares', val(ant.familiares), 'full')}
        ${item('Antecedentes oncológicos', val(ant.oncologicos), 'full')}
      </div>`;

    const g = c.gineco || {};
    const sec3 = `<div class="dl2">
      ${item('Menarquia', g.menarquia ? esc(g.menarquia) + ' años' : '—')}
      ${item('Menopausia', val(g.menopausia))}
      ${item('TRH', val(g.trh))}
      ${item('Ciclos', val(g.ciclos))}
      ${item('Duracion', val(g.ciclo_duracion))}
      ${item('Sangrado', val(g.sangrado))}
      ${item('Premenstrual', val(g.premenstrual))}
      ${item('Lactancia', val(g.lactancia))}
      ${item('FUM', g.fuc ? App.fecha(g.fuc) : '—')}
      ${item('MAC', val(g.mac))}
      ${item('Esterilizacion', val(g.esterilizacion))}
      ${item('Complicaciones', val(g.complicaciones), 'full')}
      ${item('Gestas', val(g.gestas))}
      ${item('Partos', val(g.partos))}
      ${item('Cesareas', val(g.cesareas))}
      ${item('Abortos', val(g.abortos))}
      ${item('Legrados', val(g.legrados))}
      ${item('Histerectomias', val(g.histerectomias))}
    </div>`;

    const f = c.examen_fisico || {};
    const sec4 = `<div class="dl2">
      ${item('Presion arterial', (f.pa_sistolica ? esc(f.pa_sistolica) + '/' + (f.pa_diastolica ? esc(f.pa_diastolica) : '—') : '—'))}
      ${item('Frecuencia cardiaca', f.fc ? esc(f.fc) + ' lpm' : '—')}
      ${item('Temperatura', f.temp ? esc(f.temp) + ' °C' : '—')}
      ${item('Peso', f.peso ? esc(f.peso) + ' kg' : '—')}
      ${item('Talla', f.talla ? esc(f.talla) + ' cm' : '—')}
      ${item('IMC', f.imc ? esc(f.imc) : '—')}
      ${item('Saturacion O2', f.saturacion ? esc(f.saturacion) + ' %' : '—')}
      ${item('Aspecto general', val(f.aspecto_general))}
      ${item('Mamas', val(f.mamas))}
      ${item('Cuello - Tiroides', val(f.cuello_tiroides))}
      ${item('Cuello - Ganglios', val(f.cuello_ganglios))}
      ${item('Abdomen', val(f.abdomen))}
      ${item('Extremidades', val(f.extremidades))}
      ${item('Sintomas principales', val(f.sintomas), 'full')}
    </div>`;

    const gx = c.examen_ginecologico || {};
    const sec5 = `<div class="dl2">
      ${item('Genitales externos', val(gx.genitales_externos))}
      ${item('Vagina', val(gx.vagina))}
      ${item('Cervix', val(gx.cervix))}
      ${item('Utero', val(gx.utero))}
      ${item('Anexos', val(gx.anexos))}
      ${item('Fondo de saco', val(gx.fondo_saco))}
      ${item('Citologia', val(gx.citologia), 'full')}
    </div>`;

    const para = c.paraclinicos || [];
    const sec6 = para.length
      ? `<table class="doc-table">
          <thead><tr><th style="width:26%">Examen</th><th style="width:14%">Fecha</th><th style="width:30%">Resultado</th><th>Observaciones</th></tr></thead>
          <tbody>${para.map((x) => `<tr>
            <td>${val(x.nombre)}</td>
            <td>${x.fecha ? App.fecha(x.fecha) : '—'}</td>
            <td>${val(x.resultado)}</td>
            <td>${val(x.observaciones)}</td>
          </tr>`).join('')}</tbody>
        </table>`
      : '<div class="parrafo">Sin paraclinicos registrados en esta consulta.</div>';

    const imgs = c.imagenes || [];
    const sec7 = imgs.length
      ? `<div class="imgs">${imgs.map((im) => {
          const pdf = (im.mime || '').includes('pdf');
          const cuerpo = pdf
            ? `<div class="pdf">PDF</div>`
            : `<img src="${esc(im.url)}" alt="${esc(im.titulo || '')}">`;
          return `<figure>${cuerpo}
            <figcaption>
              <strong>${esc(im.titulo || im.tipo || 'Imagen')}</strong><br>
              ${esc(im.tipo || '')}${im.fecha ? ' · ' + App.fecha(im.fecha) : ''}${im.observaciones ? '<br>' + esc(im.observaciones) : ''}
            </figcaption></figure>`;
        }).join('')}</div>`
      : '<div class="parrafo">Sin imagenes o ecografias adjuntas.</div>';

    const sec8 = `
      <div class="dl2">
        ${item('Diagnostico', val(c.diagnostico), 'full')}
        ${item('CIE-10', val(c.cie10))}
        ${item('Proxima cita', c.proxima_cita ? App.fecha(c.proxima_cita) : '—')}
        ${item('Notas', val(c.notas), 'full')}
      </div>
      <div class="k" style="margin-top:12px;color:#8a8f98;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Tratamiento indicado</div>
      <div class="parrafo">${val(c.tratamiento)}</div>`;

    hoja.innerHTML = cabecera +
      bloque(1, 'Datos personales', sec1) +
      bloque(2, 'Antecedentes personales y patologicos', sec2) +
      bloque(3, 'Antecedentes gineco-obstetricos', sec3) +
      bloque(4, 'Examen fisico y signos vitales', sec4) +
      bloque(5, 'Examen ginecologico', sec5) +
      bloque(6, 'Paraclinicos / examenes', sec6) +
      bloque(7, 'Imagenes / ecografias / ultrasonidos', sec7) +
      bloque(8, 'Diagnostico y tratamiento', sec8) +
      `<div class="firma">
        <div>${esc(m.nombre)}<br><span style="font-size:11px;color:#8a8f98">${esc(m.especialidad || '')}${m.colegiatura ? ' · ' + esc(m.colegiatura) : ''}</span></div>
        <div>Firma y sello<br><span style="font-size:11px;color:#8a8f98">${App.fecha(c.fecha_consulta)}</span></div>
      </div>`;

    document.title = `Historia ${c.historia_numero || ''} - ${p.paciente_nombre}`;
    document.getElementById('btnVolver').href = `historia.html?p=${c.paciente_id}&c=${c.id}`;
  }

  document.getElementById('btnImprimir').addEventListener('click', () => window.print());
  document.getElementById('btnCerrar').addEventListener('click', () => window.close());
  document.getElementById('btnVolver').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = document.getElementById('btnVolver').href;
  });

  (async () => {
    if (!consultaId) {
      hoja.innerHTML = App.vacio('Consulta no especificada', 'Abre la historia de un paciente y pulsa Imprimir.', 'historia');
      return;
    }
    try {
      const d = await App.api('historia.php', { params: { consulta: consultaId } });
      render(d);
    } catch (e) {
      hoja.innerHTML = App.vacio('No se pudo generar', e.message, 'historia');
    }
  })();
})();
