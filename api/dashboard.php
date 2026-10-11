<?php
/** GET /api/dashboard - resumen del panel principal */
require __DIR__ . '/_lib/init.php';

method('GET', 'OPTIONS');

$medico = require_medico();
$mid = (int) $medico['id'];
$timezone = date('Y-m-d');
$mes = date('Y-m') . '%';

$totPacientes = (int) db_scalar('SELECT COUNT(*) FROM pacientes WHERE medico_id = ?', [$mid]);
$totHistorias = (int) db_scalar('SELECT COUNT(*) FROM historias_clinicas WHERE medico_id = ?', [$mid]);
$consultasMes  = (int) db_scalar(
    "SELECT COUNT(*) FROM consultas WHERE medico_id = ? AND to_char(fecha_consulta, 'YYYY-MM') = ?",
    [$mid, date('Y-m')]
);
$nuevosMes = (int) db_scalar(
    "SELECT COUNT(*) FROM pacientes WHERE medico_id = ? AND to_char(creado_en, 'YYYY-MM') = ?",
    [$mid, date('Y-m')]
);

$citasHoy = db_rows(
    'SELECT c.*, p.nombre AS paciente_nombre, p.cedula AS paciente_cedula
       FROM citas c
       LEFT JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.medico_id = ? AND c.fecha = ?
      ORDER BY c.hora',
    [$mid, $timezone]
);

$proximas = db_rows(
    'SELECT c.*, p.nombre AS paciente_nombre, p.cedula AS paciente_cedula
       FROM citas c
       LEFT JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.medico_id = ? AND c.fecha >= ? AND c.estado <> ?
      ORDER BY c.fecha, c.hora
      LIMIT 6',
    [$mid, $timezone, 'cancelada']
);

$pendientes = (int) db_scalar(
    "SELECT COUNT(*) FROM citas WHERE medico_id = ? AND fecha = ? AND estado = 'pendiente'",
    [$mid, $timezone]
);

$ultimasConsultas = db_rows(
    'SELECT co.id, co.fecha_consulta, co.diagnostico, co.numero,
            p.id AS paciente_id, p.nombre AS paciente_nombre, p.registro_numero
       FROM consultas co
       JOIN historias_clinicas h ON h.id = co.historia_id
       JOIN pacientes p ON p.id = h.paciente_id
      WHERE co.medico_id = ?
      ORDER BY co.fecha_consulta DESC, co.id DESC
      LIMIT 6',
    [$mid]
);

json_out([
    'ok' => true,
    'hoy' => $timezone,
    'stats' => [
        'pacientes'       => $totPacientes,
        'historias'       => $totHistorias,
        'consultas_mes'   => $consultasMes,
        'pacientes_nuevos' => $nuevosMes,
        'citas_hoy'       => count($citasHoy),
        'citas_pendientes'=> $pendientes,
    ],
    'citas_hoy'        => $citasHoy,
    'proximas_citas'   => $proximas,
    'ultimas_consultas'=> $ultimasConsultas,
]);
