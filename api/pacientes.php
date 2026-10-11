<?php
/**
 * /api/pacientes.php
 * GET    ?q=&page=&limit=   listado / busqueda
 * GET    ?id=               ficha completa
 * POST   crear (+ historia clinica opcional)
 * PUT    editar
 * DELETE ?id=  eliminar
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

/* ------------------------------- GET ------------------------------- */
if ($method === 'GET') {
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

    if ($id > 0) {
        $p = db_row('SELECT * FROM pacientes WHERE id = ? AND medico_id = ?', [$id, $mid]);
        asegurar_propiedad($p, $medico);
        $historia = db_row('SELECT * FROM historias_clinicas WHERE paciente_id = ?', [$id]);
        $consultas = db_rows(
            'SELECT id, numero, fecha_consulta, diagnostico, motivo_consulta, proxima_cita
               FROM consultas WHERE historia_id = COALESCE((SELECT id FROM historias_clinicas WHERE paciente_id = ?), 0)
              ORDER BY fecha_consulta DESC, numero DESC',
            [$id]
        );
        $ultima = count($consultas) ? $consultas[0]['fecha_consulta'] : null;
        $proximaCita = db_row(
            "SELECT id, fecha, hora, estado FROM citas
              WHERE paciente_id = ? AND fecha >= CURRENT_DATE AND estado <> 'cancelada'
              ORDER BY fecha, hora LIMIT 1",
            [$id]
        );
        json_out([
            'ok'        => true,
            'paciente'  => $p,
            'historia'  => $historia,
            'consultas' => $consultas,
            'ultima_consulta' => $ultima,
            'proxima_cita'    => $proximaCita,
        ]);
    }

    $q     = trim((string) ($_GET['q'] ?? ''));
    $page  = max(1, (int) ($_GET['page'] ?? 1));
    $limit = min(200, max(1, (int) ($_GET['limit'] ?? 25)));
    $offset = ($page - 1) * $limit;

    $where = ['p.medico_id = ?'];
    $params = [$mid];
    if ($q !== '') {
        $busqueda = '%' . texto_normalizado($q) . '%';
        $where[] = '(' . sql_normalizado('p.nombre') . ' ILIKE ? OR '
            . sql_normalizado('p.cedula') . ' ILIKE ? OR '
            . sql_normalizado('p.registro_numero') . ' ILIKE ? OR '
            . sql_normalizado('p.telefono') . ' ILIKE ?)';
        array_push($params, $busqueda, $busqueda, $busqueda, $busqueda);
    }
    $whereSql = implode(' AND ', $where);

    $total = (int) db_scalar("SELECT COUNT(*) FROM pacientes p WHERE $whereSql", $params);

    $sql = "SELECT p.id, p.nombre, p.cedula, p.edad, p.sexo, p.telefono, p.correo,
                   p.registro_numero, p.procedencia, p.fecha_nacimiento, p.actualizado_en,
                   h.id AS historia_id, h.numero AS historia_numero,
                   u.ultima_consulta,
                   c.proxima_cita, c.proxima_hora
              FROM pacientes p
              LEFT JOIN historias_clinicas h ON h.paciente_id = p.id
              LEFT JOIN LATERAL (
                    SELECT MAX(co.fecha_consulta) AS ultima_consulta
                      FROM consultas co
                     WHERE co.historia_id = h.id
              ) u ON true
              LEFT JOIN LATERAL (
                    SELECT MIN(ct.fecha) AS proxima_cita, MIN(ct.hora) AS proxima_hora
                      FROM citas ct
                     WHERE ct.paciente_id = p.id
                       AND ct.fecha >= CURRENT_DATE
                       AND ct.estado <> 'cancelada'
              ) c ON true
             WHERE $whereSql
             ORDER BY p.nombre
             LIMIT " . $limit . ' OFFSET ' . $offset;

    $items = db_rows($sql, $params);

    json_out([
        'ok'    => true,
        'items' => $items,
        'total' => $total,
        'page'  => $page,
        'pages' => (int) ceil($total / $limit),
        'q'     => $q,
    ]);
}

/* ------------------------------- POST ------------------------------ */
if ($method === 'POST') {
    csrf_check();
    $in = json_in();

    $nombre = trim((string) ($in['nombre'] ?? ''));
    if ($nombre === '') {
        fail('El nombre del paciente es obligatorio');
    }

    $cedula = str_or_null($in['cedula'] ?? null);
    if ($cedula !== null) {
        $existe = db_row(
            'SELECT id FROM pacientes WHERE medico_id = ? AND cedula = ?',
            [$mid, $cedula]
        );
        if ($existe) {
            fail('Ya existe un paciente con esa cedula en tu lista');
        }
    }

    $fecha = str_or_null($in['fecha_nacimiento'] ?? null);
    $edad = int_or_null($in['edad'] ?? null);
    if ($edad === null && $fecha) {
        $edad = (new DateTime($fecha))->diff(new DateTime())->y;
    }

    $datos = only($in, [
        'registro_numero', 'nombre', 'cedula', 'sexo', 'procedencia', 'ocupacion',
        'estado_civil', 'telefono', 'correo', 'direccion', 'alergias_conocidas', 'notas',
    ]);
    $datos['medico_id'] = $mid;
    $datos['nombre'] = $nombre;
    $datos['cedula'] = $cedula;
    $datos['fecha_nacimiento'] = $fecha;
    $datos['edad'] = $edad;
    $datos['sexo'] = str_or_null($in['sexo'] ?? null) ?? 'Femenino';

    $resultado = db_transaction(function () use ($datos, $mid, $in) {
        $pid = db_insert('pacientes', $datos);

        // N de registro automatico si no viene definido
        if (empty($datos['registro_numero'])) {
            $siguiente = (int) db_scalar(
                'SELECT COUNT(*) FROM pacientes WHERE medico_id = ?',
                [$mid]
            ) + 1;
            $numero = str_pad((string) $siguiente, 5, '0', STR_PAD_LEFT);
            db_update('pacientes', ['registro_numero' => $numero], 'id = ?', [$pid]);
        }

        $historia = null;
        if (!empty($in['crear_historia'])) {
            $reg = db_scalar('SELECT registro_numero FROM pacientes WHERE id = ?', [$pid]);
            $hid = db_insert('historias_clinicas', [
                'paciente_id'    => $pid,
                'medico_id'      => $mid,
                'numero'         => $reg,
                'fecha_apertura' => date('Y-m-d'),
            ]);
            $historia = db_row('SELECT * FROM historias_clinicas WHERE id = ?', [$hid]);
        }

        return [
            'paciente' => db_row('SELECT * FROM pacientes WHERE id = ?', [$pid]),
            'historia' => $historia,
        ];
    });

    log_actividad((int) ($_SESSION['user_id'] ?? 0), 'paciente_creado', $nombre);
    json_out(['ok' => true] + $resultado, 201);
}

/* -------------------------------- PUT ------------------------------ */
if ($method === 'PUT') {
    csrf_check();
    $in = json_in();
    $id = (int) ($in['id'] ?? 0);
    $p = db_row('SELECT * FROM pacientes WHERE id = ? AND medico_id = ?', [$id, $mid]);
    asegurar_propiedad($p, $medico);

    if (empty($in['nombre'])) {
        fail('El nombre del paciente es obligatorio');
    }

    $datos = only($in, [
        'registro_numero', 'nombre', 'cedula', 'sexo', 'procedencia', 'ocupacion',
        'estado_civil', 'telefono', 'correo', 'direccion', 'alergias_conocidas', 'notas',
    ]);
    $datos['nombre'] = trim((string) $in['nombre']);
    $datos['fecha_nacimiento'] = str_or_null($in['fecha_nacimiento'] ?? null);
    $datos['edad'] = int_or_null($in['edad'] ?? null);
    if ($datos['edad'] === null && $datos['fecha_nacimiento']) {
        $datos['edad'] = (new DateTime($datos['fecha_nacimiento']))->diff(new DateTime())->y;
    }
    $datos['actualizado_en'] = date('c');

    db_update('pacientes', $datos, 'id = ?', [$id]);

    json_out([
        'ok'       => true,
        'paciente' => db_row('SELECT * FROM pacientes WHERE id = ?', [$id]),
    ]);
}

/* ------------------------------ DELETE ----------------------------- */
if ($method === 'DELETE') {
    csrf_check();
    $id = (int) ($_GET['id'] ?? (json_in()['id'] ?? 0));
    $p = db_row('SELECT * FROM pacientes WHERE id = ? AND medico_id = ?', [$id, $mid]);
    asegurar_propiedad($p, $medico);

    db_exec('UPDATE citas SET paciente_id = NULL WHERE paciente_id = ?', [$id]);
    db_exec('DELETE FROM pacientes WHERE id = ?', [$id]);

    log_actividad((int) ($_SESSION['user_id'] ?? 0), 'paciente_eliminado', $p['nombre']);
    json_out(['ok' => true]);
}

fail('Metodo no permitido', 405);
