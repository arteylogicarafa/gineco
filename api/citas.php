<?php
/**
 * /api/citas.php
 * GET    ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD | ?hoy=1 | ?paciente=N
 * POST   agendar cita
 * PUT    editar cita / cambiar estado
 * DELETE ?id=
 */

require __DIR__ . '/_lib/init.php';

$medico = require_medico();
$mid = (int) $medico['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    json_headers();
    http_response_code(204);
    exit;
}

const ESTADOS = ['pendiente', 'atendida', 'cancelada'];

function pintar_cita(array $c): array
{
    $c['id'] = (int) $c['id'];
    $c['paciente_id'] = $c['paciente_id'] !== null ? (int) $c['paciente_id'] : null;
    $c['paciente_nombre'] = $c['paciente_nombre'] ?: $c['paciente_txt'];
    return $c;
}

function validar_cita(array $in, bool $crear = true): array
{
    $fecha = str_or_null($in['fecha'] ?? null);
    $hora = str_or_null($in['hora'] ?? null);
    if ($crear && !$fecha) {
        fail('La fecha de la cita es obligatoria');
    }
    if ($crear && !$hora) {
        fail('La hora de la cita es obligatoria');
    }
    $estado = str_or_null($in['estado'] ?? null) ?? 'pendiente';
    if (!in_array($estado, ESTADOS, true)) {
        fail('Estado de cita invalido');
    }
    return [
        'fecha'       => $fecha,
        'hora'        => $hora,
        'estado'      => $estado,
        'motivo'      => str_or_null($in['motivo'] ?? null),
        'notas'       => str_or_null($in['notas'] ?? null),
        'paciente_txt'=> str_or_null($in['paciente_txt'] ?? null),
        'paciente_id' => !empty($in['paciente_id']) ? (int) $in['paciente_id'] : null,
    ];
}

const CITAS_SQL = 'SELECT c.*, p.nombre AS paciente_nombre, p.cedula AS paciente_cedula, p.telefono AS paciente_telefono
                     FROM citas c LEFT JOIN pacientes p ON p.id = c.paciente_id';

/* ------------------------------- GET ------------------------------- */
if ($method === 'GET') {
    $params = [$mid];
    $where = ['c.medico_id = ?'];

    if (!empty($_GET['paciente'])) {
        $params[] = (int) $_GET['paciente'];
        $where[] = 'c.paciente_id = ?';
    } elseif (!empty($_GET['hoy'])) {
        $where[] = 'c.fecha = CURRENT_DATE';
    } else {
        $desde = str_or_null($_GET['desde'] ?? null) ?? date('Y-m-01');
        $hasta = str_or_null($_GET['hasta'] ?? null) ?? date('Y-m-t');
        $params[] = $desde;
        $where[] = 'c.fecha >= ?';
        $params[] = $hasta;
        $where[] = 'c.fecha <= ?';
    }

    $citas = array_map('pintar_cita', db_rows(
        CITAS_SQL . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY c.fecha, c.hora',
        $params
    ));

    json_out(['ok' => true, 'items' => $citas]);
}

/* ------------------------------- POST ------------------------------ */
if ($method === 'POST') {
    csrf_check();
    $in = json_in();
    $datos = validar_cita($in, true);

    if ($datos['paciente_id']) {
        $p = db_row('SELECT id, medico_id FROM pacientes WHERE id = ? AND medico_id = ?', [$datos['paciente_id'], $mid]);
        asegurar_propiedad($p, $medico);
    } elseif (!$datos['paciente_txt']) {
        fail('Selecciona un paciente o escribe un nombre');
    }
    $datos['medico_id'] = $mid;
    $datos['actualizado_en'] = date('c');

    $id = db_insert('citas', $datos);
    $cita = pintar_cita(db_row(CITAS_SQL . ' WHERE c.id = ?', [$id]));

    log_actividad((int) ($_SESSION['user_id'] ?? 0), 'cita_creada', $cita['fecha'] . ' ' . $cita['hora']);
    json_out(['ok' => true, 'cita' => $cita], 201);
}

/* -------------------------------- PUT ------------------------------ */
if ($method === 'PUT') {
    csrf_check();
    $in = json_in();
    $id = (int) ($in['id'] ?? 0);
    $cita = db_row('SELECT * FROM citas WHERE id = ? AND medico_id = ?', [$id, $mid]);
    if (!$cita) {
        fail('Cita no encontrada', 404);
    }

    $datos = validar_cita($in + ['fecha' => $cita['fecha'], 'hora' => $cita['hora']], false);
    if (empty($in['fecha'])) {
        $datos['fecha'] = $cita['fecha'];
    }
    if (empty($in['hora'])) {
        $datos['hora'] = $cita['hora'];
    }
    $datos['actualizado_en'] = date('c');

    if ($datos['paciente_id']) {
        $p = db_row('SELECT id, medico_id FROM pacientes WHERE id = ? AND medico_id = ?', [$datos['paciente_id'], $mid]);
        asegurar_propiedad($p, $medico);
    }

    db_update('citas', $datos, 'id = ?', [$id]);
    $cita = pintar_cita(db_row(CITAS_SQL . ' WHERE c.id = ?', [$id]));

    json_out(['ok' => true, 'cita' => $cita]);
}

/* ------------------------------ DELETE ----------------------------- */
if ($method === 'DELETE') {
    csrf_check();
    $id = (int) ($_GET['id'] ?? (json_in()['id'] ?? 0));
    $cita = db_row('SELECT * FROM citas WHERE id = ? AND medico_id = ?', [$id, $mid]);
    if (!$cita) {
        fail('Cita no encontrada', 404);
    }
    db_exec('DELETE FROM citas WHERE id = ?', [$id]);
    json_out(['ok' => true]);
}

fail('Metodo no permitido', 405);
