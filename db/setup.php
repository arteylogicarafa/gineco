<?php
/**
 * db/setup.php
 * Crea el esquema y (opcionalmente) datos de demostracion.
 *
 * Uso:
 *   php db/setup.php            aplica esquema + datos demo
 *   php db/setup.php --sin-demo solo aplica el esquema
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "Este script solo puede ejecutarse desde linea de comandos.\n";
    exit(1);
}

require __DIR__ . '/../lib/init.php';

$conDemo = !in_array('--sin-demo', $argv, true);

function paso(string $txt): void
{
    echo '  -> ' . $txt . "\n";
}

echo "== Historia Clinica Ginecologica - instalacion ==\n";
echo 'Base de datos: ' . env('DB_NAME', 'gineco') . '@' . env('DB_HOST', '127.0.0.1') . ':' . env('DB_PORT', '5432') . "\n";

try {
    db();
} catch (Throwable $e) {
    echo "ERROR: no se pudo conectar a PostgreSQL.\n";
    echo $e->getMessage() . "\n";
    exit(1);
}

/* ------------------------------ esquema ------------------------------ */
$schema = file_get_contents(__DIR__ . '/schema.sql');
if ($schema === false) {
    echo "ERROR: no se pudo leer db/schema.sql\n";
    exit(1);
}
try {
    db()->exec($schema);
    paso('esquema aplicado (tablas creadas o verificadas)');
} catch (Throwable $e) {
    echo 'ERROR aplicando el esquema: ' . $e->getMessage() . "\n";
    exit(1);
}

if (!$conDemo) {
    echo "Listo (sin datos de demostracion).\n";
    exit(0);
}

/* ------------------------------- demo -------------------------------- */
function asegurar_usuario(string $usuario, array $datos): int
{
    $u = db_row('SELECT id FROM usuarios WHERE usuario = ?', [$usuario]);
    if ($u) {
        return (int) $u['id'];
    }
    $datos['usuario'] = $usuario;
    $datos['password_hash'] = password_hash($datos['password'], PASSWORD_DEFAULT);
    unset($datos['password']);
    return db_insert('usuarios', $datos);
}

function asegurar_medico(int $uid, array $datos): int
{
    $m = db_row('SELECT id FROM medicos WHERE usuario_id = ?', [$uid]);
    if ($m) {
        return (int) $m['id'];
    }
    $datos['usuario_id'] = $uid;
    return db_insert('medicos', $datos);
}

function d(string $offset): string
{
    return date('Y-m-d', strtotime($offset));
}

$existeDatos = (int) db_scalar('SELECT COUNT(*) FROM usuarios');
if ($existeDatos > 0) {
    echo "Ya existen usuarios en la base; se omiten los datos de demostracion.\n";
    echo "Listo.\n";
    exit(0);
}

echo "Insertando datos de demostracion...\n";

/* --- usuarios --- */
$adminId = asegurar_usuario('admin', [
    'nombre' => 'Administrador General',
    'email'  => 'admin@gineco.local',
    'password' => 'Admin123!',
    'rol'    => 'superadmin',
    'activo' => true,
]);
paso('superadmin: admin / Admin123!');

$doc1 = asegurar_usuario('doctora', [
    'nombre' => 'Dra. Maria Fernanda Lopez',
    'email'  => 'lopez@gineco.local',
    'password' => 'Doctor123!',
    'rol'    => 'medico',
    'activo' => true,
]);
$med1 = asegurar_medico($doc1, [
    'nombre'           => 'Dra. Maria Fernanda Lopez',
    'especialidad'     => 'Ginecologia y Obstetricia',
    'colegiatura'      => 'N° 12.345 - CMP',
    'direccion'        => 'Av. Amazonas N34-19 y Atahualpa, Quito',
    'telefono'         => '(02) 245 6789',
    'correo'           => 'lopez@gineco.local',
    'color_primario'   => '#C2185B',
    'color_secundario' => '#F06292',
    'monograma'        => 'ML',
]);
paso('medico 1: doctora / Doctor123!');

$doc2 = asegurar_usuario('doctor', [
    'nombre' => 'Dr. Andres Villacis',
    'email'  => 'villacis@gineco.local',
    'password' => 'Doctor123!',
    'rol'    => 'medico',
    'activo' => true,
]);
$med2 = asegurar_medico($doc2, [
    'nombre'           => 'Dr. Andres Villacis',
    'especialidad'     => 'Ginecologia y Obstetricia',
    'colegiatura'      => 'N° 23.456 - CMP',
    'direccion'        => 'Calle Reforma Oeste 420, Guayaquil',
    'telefono'         => '(04) 234 5678',
    'correo'           => 'villacis@gineco.local',
    'color_primario'   => '#00838F',
    'color_secundario' => '#4DD0E1',
    'monograma'        => 'AV',
]);
paso('medico 2: doctor / Doctor123!');

/* --- pacientes --- */
$pacientesDemo = [
    [$med1, 'María Elena Suárez',   '1712345678', 34, '1992-04-18', 'Quito',      '(099) 456 7890', 'maria.suarez@mail.com'],
    [$med1, 'Andrea Cabrera Ruiz',  '1723456789', 28, '1998-09-02', 'Cuenca',     '(098) 112 2334', 'andrea.c@mail.com'],
    [$med1, 'Sofia Mendoza Paz',    '1798765432', 41, '1985-01-27', 'Ambato',     '(096) 555 1212', 'sofia.m@mail.com'],
    [$med1, 'Valeria Torres',       '1787654321', 23, '2003-06-11', 'Latacunga',  '(097) 333 4455', 'valeria.t@mail.com'],
    [$med1, 'Camila Ruiz Andrade',  '1756789012', 36, '1990-11-30', 'Quito',      '(095) 777 8899', 'camila.r@mail.com'],
    [$med2, 'Daniela Fuentes',      '0908765432', 31, '1995-03-08', 'Guayaquil',  '(090) 222 3344', 'daniela.f@mail.com'],
    [$med2, 'Paula Guerrero',       '0912345670', 26, '2000-07-21', 'Guayaquil',  '(092) 666 7788', 'paula.g@mail.com'],
];

$idsPacientes = [];
foreach ($pacientesDemo as $i => [$med, $nombre, $cedula, $edad, $nac, $procedencia, $tel, $correo]) {
    $id = db_insert('pacientes', [
        'medico_id'        => $med,
        'registro_numero'  => str_pad((string) ($i + 1), 5, '0', STR_PAD_LEFT),
        'nombre'           => $nombre,
        'cedula'           => $cedula,
        'fecha_nacimiento' => $nac,
        'edad'             => $edad,
        'sexo'             => 'Femenino',
        'procedencia'      => $procedencia,
        'estado_civil'     => $i % 2 === 0 ? 'Soltera' : 'Casada',
        'telefono'         => $tel,
        'correo'           => $correo,
        'direccion'        => 'Quito, Ecuador',
    ]);
    $hid = db_insert('historias_clinicas', [
        'paciente_id'    => $id,
        'medico_id'      => $med,
        'numero'         => str_pad((string) ($i + 1), 5, '0', STR_PAD_LEFT),
        'fecha_apertura' => d('-30 days'),
    ]);
    $idsPacientes[] = ['paciente' => $id, 'historia' => $hid, 'medico' => $med, 'nombre' => $nombre];
}
paso(count($idsPacientes) . ' pacientes de demostracion');

/* --- consulta de ejemplo (paciente 1) --- */
$demo = $idsPacientes[0];
$consultaId = db_insert('consultas', [
    'historia_id'     => $demo['historia'],
    'medico_id'       => $demo['medico'],
    'numero'          => 1,
    'fecha_consulta'  => d('-15 days'),
    'hora'            => '09:30',
    'motivo_consulta' => 'Control ginecologico anual y dolor pélvico leve',
    'diagnostico'     => 'Dismenorrea primaria. Quiste ovariano funcional derecho',
    'cie10'           => 'N94.6',
    'tratamiento'     => "Ibuprofeno 400 mg cada 8 h por 5 dias.\nAnticonceptivo oral combinado.\nControl en 30 dias.",
    'proxima_cita'    => d('+15 days'),
]);

db_insert('antecedentes_personales', [
    'consulta_id'      => $consultaId,
    'hta'              => false,
    'dm'               => 'No',
    'tiroides'         => false,
    'asma'             => false,
    'insulina'         => false,
    'alergia'          => true,
    'alergia_detalle'  => 'Penicilina',
    'quirurgicos'      => 'Apendicectomia (2015) sin complicaciones',
    'familiares'       => 'Madre: HTA. Tia materna: cancer de mama',
    'oncologicos'      => 'Sin antecedentes oncológicos familiares de primer grado',
    'fumador'          => 'No',
    'alcohol'          => 'Ocasional',
    'ITS'              => 'No',
], 'consulta_id');

db_insert('secciones_gineco', [
    'consulta_id'    => $consultaId,
    'menarquia'      => 12,
    'menopausia'     => 'No aplica',
    'trh'            => 'No',
    'ciclos'         => 'Regulares',
    'ciclo_duracion' => '28 dias',
    'sangrado'       => '5 dias, moderado',
    'lactancia'      => 'No',
    'fuc'            => '2026-09-20',
    'mac'            => 'Anticonceptivo oral combinado',
    'esterilizacion' => 'No',
    'gestas'         => 2,
    'partos'         => 2,
    'cesareas'       => 1,
    'abortos'        => 0,
    'legrados'       => 0,
    'histerectomias' => 0,
    'complicaciones' => 'Cesarea por presentacion pelvica (2021)',
], 'consulta_id');

db_insert('examenes_fisicos', [
    'consulta_id'     => $consultaId,
    'pa_sistolica'    => 110,
    'pa_diastolica'   => 70,
    'fc'              => 78,
    'temp'            => 36.6,
    'peso'            => 62.50,
    'talla'           => 162,
    'imc'              => 23.84,
    'saturacion'      => 98,
    'sintomas'        => 'Dolor pelvico leve, leve metrorragia intermenstrual',
    'aspecto_general' => 'Buen estado general, hidratada',
    'mamas'           => 'Simetricas, sin nódulos palpables',
    'cuello_tiroides' => 'No aumentado',
    'cuello_ganglios' => 'No aumentados',
    'abdomen'         => 'Blando, depresible, sin defensa',
    'extremidades'    => 'Sin edemas',
], 'consulta_id');

db_insert('examenes_ginecologicos', [
    'consulta_id'         => $consultaId,
    'genitales_externos'  => 'Normales, sin lesiones',
    'vagina'              => 'Flujo claro fisiologico',
    'cervix'              => 'Nullipara, orificios cerrados',
    'utero'               => 'Antevertido, movil, normal tamano',
    'anexos'              => 'Derecha: quiste de 3 cm, indoloro. Izquierda normal',
    'fondo_saco'          => 'Libre, sin nódulos',
    'citologia'           => 'Papanicolaou tomado, resultado pendiente',
], 'consulta_id');

db_insert('paraclinicos', [
    'consulta_id' => $consultaId,
    'nombre'      => 'Ecografia transvaginal',
    'fecha'       => d('-15 days'),
    'resultado'   => 'Quiste ovariano funcional derecho de 30 mm. Endometrio 8 mm',
    'observaciones' => 'Control en 60 dias',
]);
db_insert('paraclinicos', [
    'consulta_id' => $consultaId,
    'nombre'      => 'Hemograma completo',
    'fecha'       => d('-15 days'),
    'resultado'   => 'Normal',
    'observaciones' => '',
]);
db_insert('paraclinicos', [
    'consulta_id' => $consultaId,
    'nombre'      => 'Papanicolaou (citologia cervical)',
    'fecha'       => d('-15 days'),
    'resultado'   => 'Pendiente',
    'observaciones' => 'Entregar resultado en 10 dias',
]);
paso('consulta de ejemplo con sus secciones');

/* --- segunda consulta (linea de tiempo) --- */
$consulta2 = db_insert('consultas', [
    'historia_id'     => $demo['historia'],
    'medico_id'       => $demo['medico'],
    'numero'          => 2,
    'fecha_consulta'  => d('-2 days'),
    'hora'            => '10:15',
    'motivo_consulta' => 'Control de evolucion',
    'diagnostico'     => 'Quiste ovariano en resolucion',
    'cie10'           => 'N83.2',
    'tratamiento'     => 'Continuar anticonceptivo oral. Control ecografico en 60 dias',
    'proxima_cita'    => d('+15 days'),
]);
db_insert('examenes_fisicos', [
    'consulta_id'   => $consulta2,
    'pa_sistolica'  => 118,
    'pa_diastolica' => 76,
    'fc'            => 72,
    'peso'          => 62.10,
    'talla'         => 162,
    'imc'           => 23.69,
    'sintomas'      => 'Asintomatica',
], 'consulta_id');
paso('segunda consulta del paciente 1 (historial)');

/* --- citas --- */
$citasDemo = [
    [$med1, $idsPacientes[0]['paciente'], d('+0 days'), '09:00', 'Control ginecologico', 'atendida'],
    [$med1, $idsPacientes[1]['paciente'], d('+0 days'), '10:30', 'Planificacion familiar', 'pendiente'],
    [$med1, $idsPacientes[2]['paciente'], d('+0 days'), '11:45', 'Resultado de papanicolaou', 'pendiente'],
    [$med1, $idsPacientes[3]['paciente'], d('+1 days'), '08:30', 'Primera consulta', 'pendiente'],
    [$med1, $idsPacientes[4]['paciente'], d('+2 days'), '15:00', 'Control prenatal', 'pendiente'],
    [$med1, null,                       d('+3 days'), '09:15', 'Paciente nueva: Gabriela P.', 'pendiente'],
    [$med1, $idsPacientes[0]['paciente'], d('-1 days'), '16:00', 'Evolucion de quiste', 'atendida'],
    [$med2, $idsPacientes[5]['paciente'], d('+1 days'), '11:00', 'Control ginecologico', 'pendiente'],
    [$med2, $idsPacientes[6]['paciente'], d('+2 days'), '08:00', 'Colposcopia', 'cancelada'],
];
foreach ($citasDemo as [$med, $pac, $fecha, $hora, $motivo, $estado]) {
    db_insert('citas', [
        'medico_id'    => $med,
        'paciente_id'  => $pac,
        'fecha'        => $fecha,
        'hora'         => $hora,
        'motivo'       => $motivo,
        'estado'       => $estado,
        'paciente_txt' => $pac ? null : str_replace('Paciente nueva: ', '', $motivo),
    ]);
}
paso(count($citasDemo) . ' citas de demostracion');

echo "\nListo. Accede con:\n";
echo "  Superadmin ..... admin / Admin123!\n";
echo "  Medico 1 ....... doctora / Doctor123!\n";
echo "  Medico 2 ....... doctor / Doctor123!\n";
