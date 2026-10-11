<?php
/**
 * /api/imagenes.php
 * Seccion 7 - imagenes, ecografias y ultrasonidos.
 *
 * GET    ?paciente=N   listar imagenes del paciente
 * GET    ?id=N         servir el binario (cuando UPLOAD_MODE=db)
 * POST   multipart: file + paciente_id [+ consulta_id] + metadatos
 * DELETE ?id=N         eliminar imagen (archivo incluido)
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

$MAX_TAMANO = 15 * 1024 * 1024; // 15 MB
$EXTENSIONES = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'pdf' => 'application/pdf', 'webp' => 'image/webp'];

/* ------------------------- servir binario ------------------------- */
if ($method === 'GET' && !empty($_GET['id'])) {
    $id = (int) $_GET['id'];
    $img = db_row('SELECT * FROM imagenes_ecografias WHERE id = ? AND medico_id = ?', [$id, $mid]);
    if (!$img) {
        fail('Imagen no encontrada', 404);
    }

    if ($img['contenido'] !== null) {
        $mime = $img['mime'] ?: 'image/jpeg';
        $ext = array_search($mime, $EXTENSIONES, true) ?: 'jpg';
        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline; filename="' . rawurlencode($img['titulo'] ?: ('imagen_' . $id)) . '.' . $ext . '"');
        header('Content-Length: ' . strlen($img['contenido']));
        header('Cache-Control: private, max-age=3600');
        echo $img['contenido'];
        exit;
    }

    if ($img['archivo']) {
        $ruta = APP_ROOT . '/public/' . ltrim($img['archivo'], '/');
        if (is_file($ruta)) {
            header('Content-Type: ' . ($img['mime'] ?: 'image/jpeg'));
            readfile($ruta);
            exit;
        }
    }
    fail('El archivo ya no esta disponible', 404);
}

/* --------------------------- listar ------------------------------- */
if ($method === 'GET') {
    $pid = (int) ($_GET['paciente'] ?? 0);
    if ($pid <= 0) {
        fail('Falta el id del paciente');
    }
    $filas = db_rows(
        'SELECT id, medico_id, paciente_id, consulta_id, archivo, mime, tipo, fecha, titulo, observaciones,
                (contenido IS NOT NULL) AS en_bd
           FROM imagenes_ecografias
          WHERE paciente_id = ? AND medico_id = ?
          ORDER BY fecha DESC NULLS LAST, id DESC',
        [$pid, $mid]
    );
    foreach ($filas as &$f) {
        $f['id'] = (int) $f['id'];
        $f['consulta_id'] = $f['consulta_id'] !== null ? (int) $f['consulta_id'] : null;
        $f['url'] = $f['archivo'] ? $f['archivo'] : ('../api/imagenes.php?id=' . $f['id']);
    }
    json_out(['ok' => true, 'items' => $filas]);
}

/* ---------------------------- subir -------------------------------- */
if ($method === 'POST') {
    csrf_check();

    $pid = (int) ($_POST['paciente_id'] ?? 0);
    if ($pid <= 0) {
        fail('Falta el paciente');
    }
    $paciente = db_row('SELECT id, medico_id FROM pacientes WHERE id = ? AND medico_id = ?', [$pid, $mid]);
    asegurar_propiedad($paciente, $medico);

    $consultaId = !empty($_POST['consulta_id']) ? (int) $_POST['consulta_id'] : null;
    if ($consultaId) {
        $c = db_row('SELECT id, medico_id FROM consultas WHERE id = ? AND medico_id = ?', [$consultaId, $mid]);
        if (!$c) {
            fail('Consulta no encontrada', 404);
        }
    }

    if (empty($_FILES['file'])) {
        fail('No se recibio ningun archivo');
    }
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errores = [
            UPLOAD_ERR_INI_SIZE   => 'El archivo supera el limite de PHP (upload_max_filesize)',
            UPLOAD_ERR_FORM_SIZE  => 'El archivo supera el limite del formulario',
            UPLOAD_ERR_PARTIAL    => 'El archivo se subio incompleto',
            UPLOAD_ERR_NO_FILE    => 'No se selecciono ningun archivo',
            UPLOAD_ERR_NO_TMP_DIR => 'Falta el directorio temporal de PHP',
        ];
        fail($errores[$file['error']] ?? 'Error al subir el archivo (' . $file['error'] . ')');
    }
    if ($file['size'] > $MAX_TAMANO) {
        fail('El archivo supera el maximo permitido (15 MB)');
    }

    $nombre = strtolower((string) $file['name']);
    $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
    if (!isset($EXTENSIONES[$ext])) {
        fail('Formato no permitido. Usa JPG, PNG, WEBP o PDF');
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']) ?: $EXTENSIONES[$ext];
    if (!in_array($mime, $EXTENSIONES, true)) {
        // algunos navegadores envian el mime real distinto; validamos por extension
        $mime = $EXTENSIONES[$ext];
    }

    $modo = env('UPLOAD_MODE', 'files');
    $archivo = null;
    $contenido = null;

    if ($modo === 'db') {
        $contenido = file_get_contents($file['tmp_name']);
        if ($contenido === false) {
            fail('No se pudo leer el archivo subido');
        }
    } else {
        $destinoRel = 'uploads/imagenes/' . date('Ymd_His') . '_' . bin2hex(random_bytes(5)) . '.' . $ext;
        $destino = APP_ROOT . '/public/' . $destinoRel;
        if (!is_dir(dirname($destino))) {
            mkdir(dirname($destino), 0775, true);
        }
        if (!move_uploaded_file($file['tmp_name'], $destino)) {
            fail('No se pudo guardar el archivo en el servidor');
        }
        @chmod($destino, 0644);
        $archivo = $destinoRel;
    }

    $id = db_insert('imagenes_ecografias', [
        'medico_id'     => $mid,
        'paciente_id'   => $pid,
        'consulta_id'   => $consultaId,
        'archivo'       => $archivo,
        'mime'          => $mime,
        'contenido'     => $contenido,
        'tipo'          => str_or_null($_POST['tipo'] ?? null) ?? 'Ecografia',
        'fecha'         => str_or_null($_POST['fecha'] ?? null) ?? date('Y-m-d'),
        'titulo'        => str_or_null($_POST['titulo'] ?? null),
        'observaciones' => str_or_null($_POST['observaciones'] ?? null),
    ]);

    $fila = db_row(
        'SELECT id, paciente_id, consulta_id, archivo, mime, tipo, fecha, titulo, observaciones,
                (contenido IS NOT NULL) AS en_bd
           FROM imagenes_ecografias WHERE id = ?',
        [$id]
    );
    $fila['id'] = (int) $fila['id'];
    $fila['consulta_id'] = $fila['consulta_id'] !== null ? (int) $fila['consulta_id'] : null;
    $fila['url'] = $fila['archivo'] ? $fila['archivo'] : ('../api/imagenes.php?id=' . $fila['id']);

    log_actividad((int) ($_SESSION['user_id'] ?? 0), 'imagen_subida', $fila['titulo'] ?? '');
    json_out(['ok' => true, 'imagen' => $fila], 201);
}

/* --------------------------- eliminar ------------------------------ */
if ($method === 'DELETE') {
    csrf_check();
    $id = (int) ($_GET['id'] ?? (json_in()['id'] ?? 0));
    $img = db_row('SELECT * FROM imagenes_ecografias WHERE id = ? AND medico_id = ?', [$id, $mid]);
    if (!$img) {
        fail('Imagen no encontrada', 404);
    }
    if ($img['archivo']) {
        $ruta = APP_ROOT . '/public/' . ltrim($img['archivo'], '/');
        if (is_file($ruta)) {
            @unlink($ruta);
        }
    }
    db_exec('DELETE FROM imagenes_ecografias WHERE id = ?', [$id]);
    json_out(['ok' => true]);
}

fail('Metodo no permitido', 405);
