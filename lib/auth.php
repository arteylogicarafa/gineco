<?php
/**
 * auth.php - sesiones, roles y control de acceso multi-medico
 */

declare(strict_types=1);

/** Carga el usuario autenticado (y su perfil de medico si lo tiene). */
function current_user(): ?array
{
    session_boot();
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $user = db_row(
        'SELECT id, usuario, email, nombre, rol, activo FROM usuarios WHERE id = ?',
        [(int) $_SESSION['user_id']]
    );
    if (!$user || !$user['activo']) {
        unset($_SESSION['user_id']);
        return null;
    }
    $user['medico'] = db_row('SELECT * FROM medicos WHERE usuario_id = ?', [(int) $user['id']]);
    return $user;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        fail('Sesion no valida o expirada', 401);
    }
    return $user;
}

function require_superadmin(): array
{
    $user = require_user();
    if ($user['rol'] !== 'superadmin') {
        fail('Acceso restringido: se requiere permiso de administrador', 403);
    }
    return $user;
}

/**
 * Devuelve el perfil de medico del usuario actual.
 */
function require_medico(): array
{
    $user = require_user();
    if (!empty($user['medico'])) {
        return $user['medico'];
    }
    fail('Tu cuenta no tiene un perfil medico asociado', 403);
}

/** Verifica que un recurso pertenezca al medico actual. */
function asegurar_propiedad(?array $fila, array $medico, string $campo = 'medico_id'): array
{
    if (!$fila) {
        fail('Recurso no encontrado', 404);
    }
    // si la consulta ya filtro por medico_id, la columna puede no estar seleccionada
    if (array_key_exists($campo, $fila) && (int) $fila[$campo] !== (int) $medico['id']) {
        fail('Recurso no encontrado', 404);
    }
    return $fila;
}

function login_attempt(string $usuario, string $password): array
{
    $usuario = trim($usuario);
    if ($usuario === '' || $password === '') {
        fail('Ingresa usuario y contrasena');
    }
    $user = db_row('SELECT * FROM usuarios WHERE usuario = ? OR email = ?', [$usuario, $usuario]);
    if (!$user || !password_verify($password, $user['password_hash'])) {
        log_actividad(null, 'login_fallido', $usuario);
        fail('Usuario o contrasena incorrectos', 401);
    }
    if (!$user['activo']) {
        fail('La cuenta esta desactivada. Contacta al administrador', 403);
    }

    session_boot();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['csrf']    = bin2hex(random_bytes(24));

    db_exec('UPDATE usuarios SET ultimo_acceso = now() WHERE id = ?', [(int) $user['id']]);
    log_actividad((int) $user['id'], 'login', $usuario);

    $full = current_user();
    if (!$full) {
        fail('No se pudo iniciar sesion', 500);
    }
    return $full;
}

function logout(): void
{
    session_boot();
    $uid = $_SESSION['user_id'] ?? null;
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], (bool) $p['secure'], (bool) $p['httponly']);
    }
    session_destroy();
    log_actividad($uid ? (int) $uid : null, 'logout');
}

/** Formato de usuario para respuestas de la API. */
function user_payload(array $user): array
{
    return [
        'id'      => (int) $user['id'],
        'usuario' => $user['usuario'],
        'nombre'  => $user['nombre'],
        'email'   => $user['email'],
        'rol'     => $user['rol'],
        'medico'  => !empty($user['medico']) ? medico_payload($user['medico']) : null,
    ];
}

function medico_payload(array $m): array
{
    $m['id'] = (int) $m['id'];
    $m['usuario_id'] = (int) $m['usuario_id'];
    $m['logo_url'] = uploads_url($m['logo'] ?? null);
    return $m;
}

/**
 * Ruta del logo/imagen tal como el navegador debe resolverla.
 * Las paginas viven dentro de public/, por lo que la ruta relativa
 * funciona igual en XAMPP (/gineco/public/...) y en Vercel (raiz = public).
 */
function uploads_url(?string $ruta): ?string
{
    if (!$ruta) {
        return null;
    }
    return $ruta;
}
