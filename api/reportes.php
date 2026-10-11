<?php
/**
 * /api/reportes.php
 * GET ?tipo=pacientes            lista de pacientes del medico
 * GET ?tipo=citas&desde&hasta    citas por rango de fechas
 * GET ?tipo=consultas&desde&hasta consultas por rango de fechas
 * GET ?tipo=resumen              indicadores generales
 */

require __DIR__ . '/../lib/init.php';

$medico = require_medico();
$mid = (int) $medico['id'];

method('GET', 'OPTIONS');

$tipo = (string) ($_GET['tipo'] ?? 'pacientes');
$desde = str_or_null($_GET['desde'] ?? null) ?? date('Y-m-01');
$hasta = str_or_null($_GET['hasta'] ?? null) ?? date('Y-m-t');

switch ($tipo) {
    case 'citas':
        $items = db_rows(
            'SELECT c.id, c.fecha, c.hora, c.estado, c.motivo, c.notas,
                    COALESCE(p.nombre, c.paciente_txt) AS paciente, p.cedula,
                    p.telefono
               FROM citas c
               LEFT JOIN pacientes p ON p.id = c.paciente_id
              WHERE c.medico_id = ? AND c.fecha BETWEEN ? AND ?
              ORDER BY c.fecha, c.hora',
            [$mid, $desde, $hasta]
        );
        $totales = [
            'total'      => count($items),
            'pendientes' => count(array_filter($items, fn ($i) => $i['estado'] === 'pendiente')),
            'atendidas'  => count(array_filter($items, fn ($i) => $i['estado'] === 'atendida')),
            'canceladas' => count(array_filter($items, fn ($i) => $i['estado'] === 'cancelada')),
        ];
        json_out(['ok' => true, 'tipo' => $tipo, 'desde' => $desde, 'hasta' => $hasta, 'items' => $items, 'totales' => $totales]);

    case 'consultas':
        $items = db_rows(
            'SELECT co.id, co.fecha_consulta, co.numero, co.diagnostico, co.cie10,
                    p.id AS paciente_id, p.nombre AS paciente, p.cedula, p.registro_numero
               FROM consultas co
               JOIN historias_clinicas h ON h.id = co.historia_id
               JOIN pacientes p ON p.id = h.paciente_id
              WHERE co.medico_id = ? AND co.fecha_consulta BETWEEN ? AND ?
              ORDER BY co.fecha_consulta DESC, co.id DESC',
            [$mid, $desde, $hasta]
        );
        json_out(['ok' => true, 'tipo' => $tipo, 'desde' => $desde, 'hasta' => $hasta, 'items' => $items, 'totales' => ['total' => count($items)]]);

    case 'resumen':
        $porEstado = db_rows(
            "SELECT estado, COUNT(*)::int AS total FROM citas
              WHERE medico_id = ? AND fecha BETWEEN ? AND ? GROUP BY estado",
            [$mid, $desde, $hasta]
        );
        $diagnosticos = db_rows(
            'SELECT COALESCE(diagnostico, ?) AS diagnostico, COUNT(*)::int AS total
               FROM consultas
              WHERE medico_id = ? AND fecha_consulta BETWEEN ? AND ?
              GROUP BY diagnostico ORDER BY total DESC LIMIT 10',
            ['Sin diagnostico registrado', $mid, $desde, $hasta]
        );
        json_out(['ok' => true, 'tipo' => $tipo, 'desde' => $desde, 'hasta' => $hasta, 'por_estado' => $porEstado, 'diagnosticos' => $diagnosticos]);

    case 'pacientes':
    default:
        $items = db_rows(
            'SELECT p.id, p.nombre, p.cedula, p.registro_numero, p.edad, p.telefono, p.procedencia,
                    p.creado_en::date AS registrado,
                    h.numero AS historia,
                    (SELECT COUNT(*) FROM consultas co WHERE co.historia_id = h.id)::int AS consultas,
                    (SELECT MAX(co.fecha_consulta) FROM consultas co WHERE co.historia_id = h.id) AS ultima_consulta,
                    (SELECT MIN(c.fecha) FROM citas c WHERE c.paciente_id = p.id
                        AND c.fecha >= CURRENT_DATE AND c.estado <> ?) AS proxima_cita
               FROM pacientes p
               LEFT JOIN historias_clinicas h ON h.paciente_id = p.id
              WHERE p.medico_id = ?
              ORDER BY p.nombre',
            ['cancelada', $mid]
        );
        json_out(['ok' => true, 'tipo' => 'pacientes', 'items' => $items, 'totales' => ['total' => count($items)]]);
}
