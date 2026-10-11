<?php
/**
 * /api/historia.php
 * Historia clinica ginecologica: consulta completa con sus 9 secciones.
 *
 * GET  ?paciente=ID   contexto completo del paciente (historia + consultas + ultima)
 * GET  ?consulta=ID   una consulta con todas sus secciones (edicion / impresion)
 * POST                crear nueva consulta
 * PUT                 editar consulta existente
 */

require __DIR__ . '/../lib/init.php';

$medico = require_medico();
$mid = (int) $medico['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    json_headers();
    http_response_code(204);
    exit;
}

/* ==================================================================
 * Helpers
 * ================================================================== */

/**
 * Especificacion de las secciones del formulario.
 * alias => [ tabla => ..., campos => [columna => tipo] ]
 * tipos: b=booleano, i=entero, n=decimal, d=fecha, s=texto
 */
function secciones_spec(): array
{
    return [
        'antecedentes' => [
            'tabla' => 'antecedentes_personales',
            'campos' => [
                'hta' => 'b', 'dm' => 's', 'tiroides' => 'b', 'tiroides_detalle' => 's',
                'asma' => 'b', 'insulina' => 'b', 'alergia' => 'b', 'alergia_detalle' => 's',
                'quirurgicos' => 's', 'otros' => 's', 'familiares' => 's', 'oncologicos' => 's',
                'fumador' => 's', 'alcohol' => 's', 'ITS' => 's',
            ],
        ],
        'gineco' => [
            'tabla' => 'secciones_gineco',
            'campos' => [
                'menarquia' => 'i', 'menopausia' => 's', 'trh' => 's', 'ciclos' => 's',
                'ciclo_duracion' => 's', 'sangrado' => 's', 'premenstrual' => 's',
                'lactancia' => 's', 'fuc' => 'd', 'mac' => 's', 'esterilizacion' => 's',
                'gestas' => 'i', 'partos' => 'i', 'cesareas' => 'i', 'abortos' => 'i',
                'legrados' => 'i', 'histerectomias' => 'i', 'complicaciones' => 's',
            ],
        ],
        'examen_fisico' => [
            'tabla' => 'examenes_fisicos',
            'campos' => [
                'pa_sistolica' => 'i', 'pa_diastolica' => 'i', 'fc' => 'i', 'temp' => 'n',
                'peso' => 'n', 'talla' => 'n', 'imc' => 'n', 'saturacion' => 'i',
                'sintomas' => 's', 'aspecto_general' => 's', 'mamas' => 's',
                'cuello_tiroides' => 's', 'cuello_ganglios' => 's', 'abdomen' => 's',
                'extremidades' => 's',
            ],
        ],
        'examen_ginecologico' => [
            'tabla' => 'examenes_ginecologicos',
            'campos' => [
                'genitales_externos' => 's', 'vagina' => 's', 'cervix' => 's',
                'utero' => 's', 'anexos' => 's', 'fondo_saco' => 's', 'citologia' => 's',
            ],
        ],
    ];
}

function cast_valor(mixed $v, string $tipo): mixed
{
    switch ($tipo) {
        case 'b':
            if (is_bool($v)) {
                return $v;
            }
            return in_array(strtolower((string) $v), ['1', 'true', 'si', 'sí', 'on', 'yes'], true);
        case 'i':
            return int_or_null($v);
        case 'n':
            return num_or_null($v);
        case 'd':
            $s = str_or_null($v);
            return $s === null ? null : substr($s, 0, 10);
        default:
            return str_or_null($v);
    }
}

function filtrar_seccion(array $entrada, array $spec): array
{
    $out = [];
    foreach ($spec as $col => $tipo) {
        if (array_key_exists($col, $entrada)) {
            $out[$col] = cast_valor($entrada[$col], $tipo);
        }
    }
    return $out;
}

function upsert_seccion(string $tabla, int $consultaId, array $datos): void
{
    if (!$datos) {
        return;
    }
    $existe = db_row("SELECT consulta_id FROM {$tabla} WHERE consulta_id = ?", [$consultaId]);
    if ($existe) {
        db_update($tabla, $datos, 'consulta_id = ?', [$consultaId]);
    } else {
        $datos['consulta_id'] = $consultaId;
        db_insert($tabla, $datos, 'consulta_id');
    }
}

function pintar_imagen(array $img): array
{
    $img['id'] = (int) $img['id'];
    $img['consulta_id'] = $img['consulta_id'] !== null ? (int) $img['consulta_id'] : null;
    $img['paciente_id'] = (int) $img['paciente_id'];
    $img['url'] = $img['archivo']
        ? $img['archivo']
        : ($img['contenido'] !== null ? '../api/imagenes.php?id=' . $img['id'] : null);
    unset($img['contenido']);
    return $img;
}

/** Carga una consulta completa con todas sus secciones. */
function cargar_consulta(int $consultaId, int $medicoId): array
{
    $c = db_row(
        'SELECT co.*, h.paciente_id, h.numero AS historia_numero, h.id AS historia_id,
                p.nombre AS paciente_nombre, p.cedula AS paciente_cedula,
                p.registro_numero, p.edad, p.sexo, p.telefono, p.fecha_nacimiento,
                p.procedencia, p.ocupacion, p.estado_civil, p.correo, p.direccion,
                p.alergias_conocidas
           FROM consultas co
           JOIN historias_clinicas h ON h.id = co.historia_id
           JOIN pacientes p ON p.id = h.paciente_id
          WHERE co.id = ? AND co.medico_id = ?',
        [$consultaId, $medicoId]
    );
    if (!$c) {
        fail('Consulta no encontrada', 404);
    }

    foreach (secciones_spec() as $alias => $def) {
        $c[$alias] = db_row("SELECT * FROM {$def['tabla']} WHERE consulta_id = ?", [$consultaId]);
    }

    $c['paraclinicos'] = db_rows(
        'SELECT * FROM paraclinicos WHERE consulta_id = ? ORDER BY fecha NULLS LAST, id',
        [$consultaId]
    );
    $c['imagenes'] = array_map(
        'pintar_imagen',
        db_rows('SELECT * FROM imagenes_ecografias WHERE consulta_id = ? ORDER BY id', [$consultaId])
    );

    $c['id'] = (int) $c['id'];
    $c['historia_id'] = (int) $c['historia_id'];
    $c['paciente_id'] = (int) $c['paciente_id'];
    $c['numero'] = (int) $c['numero'];
    return $c;
}

/* ==================================================================
 * GET
 * ================================================================== */
if ($method === 'GET') {
    if (!empty($_GET['consulta'])) {
        $c = cargar_consulta((int) $_GET['consulta'], $mid);
        json_out([
            'ok'       => true,
            'consulta' => $c,
            'medico'   => medico_payload($medico),
        ]);
    }

    $pid = (int) ($_GET['paciente'] ?? 0);
    if ($pid <= 0) {
        fail('Falta el id del paciente');
    }

    $paciente = db_row('SELECT * FROM pacientes WHERE id = ? AND medico_id = ?', [$pid, $mid]);
    asegurar_propiedad($paciente, $medico);

    $historia = db_row('SELECT * FROM historias_clinicas WHERE paciente_id = ?', [$pid]);

    $listado = db_rows(
        'SELECT co.id, co.numero, co.fecha_consulta, co.motivo_consulta, co.diagnostico,
                co.cie10, co.proxima_cita, co.actualizado_en
           FROM consultas co
          WHERE co.historia_id = COALESCE((SELECT id FROM historias_clinicas WHERE paciente_id = ?), 0)
          ORDER BY co.fecha_consulta DESC, co.numero DESC',
        [$pid]
    );

    $ultima = $listado ? cargar_consulta((int) $listado[0]['id'], $mid) : null;

    $imagenes = array_map(
        'pintar_imagen',
        db_rows('SELECT * FROM imagenes_ecografias WHERE paciente_id = ? ORDER BY id DESC', [$pid])
    );

    $citas = db_rows(
        "SELECT * FROM citas WHERE paciente_id = ? AND fecha >= CURRENT_DATE
          ORDER BY fecha, hora LIMIT 5",
        [$pid]
    );

    json_out([
        'ok'        => true,
        'paciente'  => $paciente,
        'historia'  => $historia,
        'consultas' => $listado,
        'ultima'    => $ultima,
        'imagenes'  => $imagenes,
        'citas'     => $citas,
        'medico'    => medico_payload($medico),
    ]);
}

/* ==================================================================
 * POST / PUT - guardar consulta
 * ================================================================== */
if ($method === 'POST' || $method === 'PUT') {
    csrf_check();
    $in = json_in();
    $spec = secciones_spec();

    $consultaId = $method === 'PUT' ? (int) ($in['consulta_id'] ?? 0) : 0;

    // ---------- paciente (seccion 1) ----------
    $pacienteId = (int) ($in['paciente_id'] ?? 0);
    if ($pacienteId <= 0) {
        fail('Falta el paciente');
    }
    $paciente = db_row('SELECT * FROM pacientes WHERE id = ? AND medico_id = ?', [$pacienteId, $mid]);
    asegurar_propiedad($paciente, $medico);

    if (!empty($in['paciente']) && is_array($in['paciente'])) {
        $pIn = $in['paciente'];
        $pdatos = only($pIn, [
            'registro_numero', 'nombre', 'cedula', 'sexo', 'procedencia', 'ocupacion',
            'estado_civil', 'telefono', 'correo', 'direccion', 'alergias_conocidas', 'notas',
        ]);
        $pdatos['fecha_nacimiento'] = str_or_null($pIn['fecha_nacimiento'] ?? null);
        $pdatos['edad'] = int_or_null($pIn['edad'] ?? null);
        if ($pdatos['edad'] === null && $pdatos['fecha_nacimiento']) {
            $pdatos['edad'] = (new DateTime($pdatos['fecha_nacimiento']))->diff(new DateTime())->y;
        }
        $pdatos['actualizado_en'] = date('c');
        db_update('pacientes', $pdatos, 'id = ?', [$pacienteId]);
    }

    $fecha = substr((string) ($in['fecha_consulta'] ?? date('Y-m-d')), 0, 10);
    if ($fecha === '') {
        $fecha = date('Y-m-d');
    }

    $cDatos = [
        'fecha_consulta'  => $fecha,
        'hora'            => str_or_null($in['hora'] ?? null),
        'motivo_consulta' => str_or_null($in['motivo_consulta'] ?? null),
        'diagnostico'     => str_or_null($in['diagnostico'] ?? null),
        'cie10'           => str_or_null($in['cie10'] ?? null),
        'tratamiento'     => str_or_null($in['tratamiento'] ?? null),
        'proxima_cita'    => str_or_null($in['proxima_cita'] ?? null),
        'notas'           => str_or_null($in['notas'] ?? null),
        'actualizado_en'  => date('c'),
    ];

    $resultado = db_transaction(function () use ($in, $spec, $mid, $pacienteId, $consultaId, $cDatos, $method, $fecha) {
        // ---------- historia clinica ----------
        $historia = db_row('SELECT * FROM historias_clinicas WHERE paciente_id = ?', [$pacienteId]);
        if (!$historia) {
            $reg = db_scalar('SELECT registro_numero FROM pacientes WHERE id = ?', [$pacienteId]);
            if (!$reg) {
                $n = (int) db_scalar('SELECT COUNT(*) FROM historias_clinicas WHERE medico_id = ?', [$mid]) + 1;
                $reg = str_pad((string) $n, 5, '0', STR_PAD_LEFT);
            }
            $hid = db_insert('historias_clinicas', [
                'paciente_id'    => $pacienteId,
                'medico_id'      => $mid,
                'numero'         => $reg,
                'fecha_apertura' => $fecha,
            ]);
            $historia = db_row('SELECT * FROM historias_clinicas WHERE id = ?', [$hid]);
        }
        $historiaId = (int) $historia['id'];

        // ---------- consulta ----------
        if ($method === 'PUT') {
            $existe = db_row('SELECT id FROM consultas WHERE id = ? AND medico_id = ?', [$consultaId, $mid]);
            if (!$existe) {
                fail('Consulta no encontrada', 404);
            }
            db_update('consultas', $cDatos, 'id = ?', [$consultaId]);
            $cid = $consultaId;
        } else {
            $siguiente = (int) db_scalar(
                'SELECT COALESCE(MAX(numero), 0) + 1 FROM consultas WHERE historia_id = ?',
                [$historiaId]
            );
            $nuevos = $cDatos + ['historia_id' => $historiaId, 'medico_id' => $mid, 'numero' => $siguiente];
            $cid = db_insert('consultas', $nuevos);
        }

        // ---------- secciones 2 a 5 ----------
        foreach ($spec as $alias => $def) {
            if (isset($in[$alias]) && is_array($in[$alias])) {
                upsert_seccion($def['tabla'], $cid, filtrar_seccion($in[$alias], $def['campos']));
            }
        }

        // ---------- seccion 6: paraclinicos (reemplazo completo) ----------
        if (array_key_exists('paraclinicos', $in) && is_array($in['paraclinicos'])) {
            db_exec('DELETE FROM paraclinicos WHERE consulta_id = ?', [$cid]);
            foreach ($in['paraclinicos'] as $fila) {
                if (trim((string) ($fila['nombre'] ?? '')) === '') {
                    continue;
                }
                db_insert('paraclinicos', [
                    'consulta_id'   => $cid,
                    'nombre'        => trim((string) $fila['nombre']),
                    'fecha'         => str_or_null($fila['fecha'] ?? null),
                    'resultado'     => str_or_null($fila['resultado'] ?? null),
                    'observaciones' => str_or_null($fila['observaciones'] ?? null),
                ]);
            }
        }

        // ---------- seccion 7: vincular imagenes subidas ----------
        foreach (array_filter(array_map('intval', (array) ($in['imagen_ids'] ?? []))) as $imgId) {
            db_exec(
                'UPDATE imagenes_ecografias SET consulta_id = ? WHERE id = ? AND paciente_id = ? AND medico_id = ?',
                [$cid, $imgId, $pacienteId, $mid]
            );
        }

        // ---------- seccion 7: actualizar metadatos existentes ----------
        if (!empty($in['imagenes']) && is_array($in['imagenes'])) {
            foreach ($in['imagenes'] as $img) {
                $imgId = (int) ($img['id'] ?? 0);
                if ($imgId <= 0) {
                    continue;
                }
                db_exec(
                    'UPDATE imagenes_ecografias
                        SET fecha = ?, tipo = ?, titulo = ?, observaciones = ?
                      WHERE id = ? AND paciente_id = ? AND medico_id = ?',
                    [
                        str_or_null($img['fecha'] ?? null),
                        str_or_null($img['tipo'] ?? null),
                        str_or_null($img['titulo'] ?? null),
                        str_or_null($img['observaciones'] ?? null),
                        $imgId, $pacienteId, $mid,
                    ]
                );
            }
        }

        return $cid;
    });

    log_actividad(
        (int) ($_SESSION['user_id'] ?? 0),
        $method === 'POST' ? 'consulta_creada' : 'consulta_editada',
        '#' . $resultado
    );

    json_out([
        'ok'          => true,
        'consulta_id' => $resultado,
        'consulta'    => cargar_consulta($resultado, $mid),
    ], $method === 'POST' ? 201 : 200);
}

fail('Metodo no permitido', 405);
