<?php
/**
 * /api/medicos.php
 * GET    perfil propio (o ?all=1 lista global para superadmin)
 * POST   superadmin: crear cuenta de medico
 * PUT    editar perfil propio / otro medico (superadmin) / contrasena
 * DELETE ?id=  desactivar medico (superadmin)
 */

require __DIR__ . '/../lib/init.php';

$method = $_SERVER['REQUEST_METHOD'];
$user = require_user();

if ($method === 'OPTIONS') {
    json_headers();
    http_response_code(204);
    exit;
}

/** Guarda el logo y devuelve la ruta relativa o el data-URL (UPLOAD_MODE=db). */
function guardar_logo(string $dataUrl, int $medicoId): string
{
    if (!preg_match('#^data:image/(png|jpe?g|webp|svg\+xml);base64,#i', $dataUrl, $m)) {
        fail('El logo debe ser una imagen PNG, JPG o WEBP');
    }
    $binario = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    if ($binario === false || strlen($binario) > 3 * 1024 * 1024) {
        fail('Logo invalido o demasiado grande (max 3 MB)');
    }

    // En modo base de datos (Vercel/serverless) el logo se guarda tal cual.
    if (env('UPLOAD_MODE', 'files') === 'db') {
        return $dataUrl;
    }

    $ext = strtolower($m[1]);
    $ext = $ext === 'jpeg' ? 'jpg' : ($ext === 'svg+xml' ? 'svg' : $ext);
    $rel = 'uploads/logos/logo_' . $medicoId . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $destino = APP_ROOT . '/public/' . $rel;
    if (!is_dir(dirname($destino))) {
        mkdir(dirname($destino), 0775, true);
    }
    if (file_put_contents($destino, $binario) === false) {
        fail('No se pudo guardar el logo', 500);
    }
    @chmod($destino, 0644);
    return $rel;
}

/** Borra un logo almacenado como fichero (ignora los data-URL). */
function borrar_logo_fichero(?string $ruta): void
{
    if (!$ruta || !str_starts_with($ruta, 'uploads/')) {
        return;
    }
    $fichero = APP_ROOT . '/public/' . ltrim($ruta, '/');
    if (is_file($fichero)) {
        @unlink($fichero);
    }
}

/* ------------------------------- GET ------------------------------- */
if ($method === 'GET') {
    if (!empty($_GET['all'])) {
        require_superadmin();
        $items = db_rows(
            'SELECT m.*, u.usuario, u.activo, u.rol, u.ultimo_acceso,
                    (SELECT COUNT(*) FROM pacientes p WHERE p.medico_id = m.id)::int AS pacientes,
                    (SELECT COUNT(*) FROM citas c WHERE c.medico_id = m.id)::int AS citas
               FROM medicos m
               JOIN usuarios u ON u.id = m.usuario_id
              ORDER BY m.nombre'
        );
        foreach ($items as &$i) {
            $i['id'] = (int) $i['id'];
            $i['usuario_id'] = (int) $i['usuario_id'];
            $i['logo_url'] = uploads_url($i['logo']);
        }
        $admins = db_rows(
            "SELECT id, usuario, nombre, email, activo, ultimo_acceso FROM usuarios WHERE rol = 'superadmin' ORDER BY nombre"
        );
        json_out(['ok' => true, 'items' => $items, 'admins' => $admins]);
    }

    if (empty($user['medico'])) {
        fail('Esta cuenta no tiene perfil medico', 404);
    }
    json_out(['ok' => true, 'medico' => medico_payload($user['medico'])]);
}

/* ------------------------------- POST ------------------------------ */
if ($method === 'POST') {
    require_superadmin();
    csrf_check();
    $in = json_in();

    $usuario = trim((string) ($in['usuario'] ?? ''));
    $password = (string) ($in['password'] ?? '');
    $nombre = trim((string) ($in['nombre'] ?? ''));

    if ($usuario === '' || $nombre === '') {
        fail('Usuario y nombre son obligatorios');
    }
    if (!preg_match('/^[a-zA-Z0-9._-]{3,40}$/', $usuario)) {
        fail('El usuario debe tener 3-40 caracteres (letras, numeros, . _ -)');
    }
    if (strlen($password) < 6) {
        fail('La contrasena debe tener al menos 6 caracteres');
    }
    if (db_row('SELECT id FROM usuarios WHERE usuario = ? OR email = ?', [$usuario, $usuario])) {
        fail('Ese usuario ya existe');
    }

    $email = str_or_null($in['email'] ?? null);
    if ($email && db_row('SELECT id FROM usuarios WHERE email = ?', [$email])) {
        fail('Ese correo ya esta registrado');
    }

    $resultado = db_transaction(function () use ($in, $usuario, $password, $nombre, $email) {
        $uid = db_insert('usuarios', [
            'usuario'       => $usuario,
            'email'         => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'nombre'        => $nombre,
            'rol'           => 'medico',
            'activo'        => true,
        ]);
        $mid = db_insert('medicos', [
            'usuario_id'       => $uid,
            'nombre'           => $nombre,
            'especialidad'     => str_or_null($in['especialidad'] ?? null) ?? 'Ginecologia y Obstetricia',
            'colegiatura'      => str_or_null($in['colegiatura'] ?? null),
            'direccion'        => str_or_null($in['direccion'] ?? null),
            'telefono'         => str_or_null($in['telefono'] ?? null),
            'correo'           => $email,
            'color_primario'   => str_or_null($in['color_primario'] ?? null) ?? '#C2185B',
            'color_secundario' => str_or_null($in['color_secundario'] ?? null) ?? '#F06292',
            'monograma'        => str_or_null($in['monograma'] ?? null) ?? mb_strtoupper(mb_substr($nombre, 0, 2, 'UTF-8'), 'UTF-8'),
        ]);
        return ['usuario_id' => $uid, 'medico_id' => $mid];
    });

    log_actividad((int) $user['id'], 'medico_creado', $usuario);
    json_out(['ok' => true] + $resultado, 201);
}

/* -------------------------------- PUT ------------------------------ */
if ($method === 'PUT') {
    csrf_check();
    $in = json_in();

    /* --- cambiar contrasena propia --- */
    if (!empty($in['accion']) && $in['accion'] === 'password') {
        $actual = (string) ($in['password_actual'] ?? '');
        $nueva = (string) ($in['password_nueva'] ?? '');
        $hash = db_scalar('SELECT password_hash FROM usuarios WHERE id = ?', [(int) $user['id']]);
        if (!password_verify($actual, (string) $hash)) {
            fail('La contrasena actual es incorrecta', 401);
        }
        if (strlen($nueva) < 6) {
            fail('La nueva contrasena debe tener al menos 6 caracteres');
        }
        db_update('usuarios', ['password_hash' => password_hash($nueva, PASSWORD_DEFAULT)], 'id = ?', [(int) $user['id']]);
        json_out(['ok' => true, 'mensaje' => 'Contrasena actualizada']);
    }

    /* --- editar perfil (propio o de otro medico si eres superadmin) --- */
    $idPropio = !empty($user['medico']) ? (int) $user['medico']['id'] : 0;
    $id = !empty($in['id']) ? (int) $in['id'] : $idPropio;

    if ($id <= 0) {
        fail('No tienes perfil medico para editar', 403);
    }
    if ($id !== $idPropio) {
        require_superadmin();
    }
    $m = db_row('SELECT * FROM medicos WHERE id = ?', [$id]);
    if (!$m) {
        fail('Medico no encontrado', 404);
    }

    $datos = only($in, ['nombre', 'especialidad', 'colegiatura', 'direccion', 'telefono', 'correo']);
    foreach ($datos as $k => $v) {
        $datos[$k] = str_or_null($v);
    }
    if (isset($in['color_primario'])) {
        $datos['color_primario'] = preg_replace('/[^#a-fA-F0-9]/', '', (string) $in['color_primario']) ?: '#C2185B';
    }
    if (isset($in['color_secundario'])) {
        $datos['color_secundario'] = preg_replace('/[^#a-fA-F0-9]/', '', (string) $in['color_secundario']) ?: '#F06292';
    }
    if (isset($in['monograma'])) {
        $datos['monograma'] = mb_strtoupper(mb_substr(trim((string) $in['monograma']), 0, 4, 'UTF-8'), 'UTF-8');
    }
    if (empty($datos['nombre'])) {
        fail('El nombre es obligatorio');
    }

    if (!empty($in['logo']) && is_string($in['logo'])) {
        $ruta = guardar_logo($in['logo'], $id);
        $anterior = $m['logo'];
        $datos['logo'] = $ruta;
        if ($anterior && $anterior !== $ruta) {
            borrar_logo_fichero($anterior);
        }
    }
    if (!empty($in['quitar_logo'])) {
        borrar_logo_fichero($m['logo'] ?? null);
        $datos['logo'] = null;
    }

    db_update('medicos', $datos, 'id = ?', [$id]);

    $actualizado = db_row('SELECT * FROM medicos WHERE id = ?', [$id]);
    json_out(['ok' => true, 'medico' => medico_payload($actualizado)]);
}

/* ------------------------------ DELETE ----------------------------- */
if ($method === 'DELETE') {
    require_superadmin();
    csrf_check();
    $id = (int) ($_GET['id'] ?? (json_in()['id'] ?? 0));
    $accion = (string) ($_GET['accion'] ?? (json_in()['accion'] ?? 'toggle'));

    $m = db_row('SELECT * FROM medicos WHERE id = ?', [$id]);
    if (!$m) {
        fail('Medico no encontrado', 404);
    }

    if ($accion === 'eliminar') {
        if ((int) $m['usuario_id'] === (int) $user['id']) {
            fail('No puedes eliminar tu propia cuenta', 400);
        }
        db_exec('DELETE FROM usuarios WHERE id = ?', [(int) $m['usuario_id']]);
        json_out(['ok' => true]);
    }

    $actual = db_scalar('SELECT activo FROM usuarios WHERE id = ?', [(int) $m['usuario_id']]);
    db_update('usuarios', ['activo' => !$actual], 'id = ?', [(int) $m['usuario_id']]);
    json_out(['ok' => true, 'activo' => !$actual]);
}

fail('Metodo no permitido', 405);
