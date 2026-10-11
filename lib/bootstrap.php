<?php
/**
 * bootstrap.php - configuracion, sesion y helpers HTTP/JSON
 * Ruta base: gineco/
 */

declare(strict_types=1);

define('APP_ROOT', dirname(__DIR__));

/* ------------------------------------------------------------------
 * Carga de variables de entorno (.env o variables del servidor)
 * ------------------------------------------------------------------ */
function env_load(string $file): void
{
    if (!is_file($file)) {
        return;
    }
    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }
        $key   = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));
        if ($value !== '' && ($value[0] === '"' || $value[0] === "'") && str_ends_with($value, $value[0])) {
            $value = substr($value, 1, -1);
        }
        if (getenv($key) === false) {
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }
}

function env(string $key, mixed $default = null): mixed
{
    $val = getenv($key);
    if ($val === false || $val === '') {
        return $default;
    }
    return $val;
}

env_load(APP_ROOT . '/.env');

/* ------------------------------------------------------------------
 * Manejo de errores / debug
 * ------------------------------------------------------------------ */
ini_set('display_errors', env('APP_DEBUG', '0') === '1' ? '1' : '0');
error_reporting(E_ALL);
date_default_timezone_set(env('APP_TIMEZONE', 'America/Guayaquil'));

/* ------------------------------------------------------------------
 * Respuestas JSON
 * ------------------------------------------------------------------ */
function json_headers(): void
{
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origin) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    }
}

function json_out(mixed $data, int $status = 200): never
{
    json_headers();
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $mensaje, int $status = 400, array $extra = []): never
{
    json_out(array_merge(['ok' => false, 'error' => $mensaje], $extra), $status);
}

function json_in(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        $body = $_POST;
        return $body;
    }
    $decoded = json_decode($raw, true);
    $body = is_array($decoded) ? $decoded : [];
    return $body;
}

/**
 * Enrutador minimo: detecta el metodo HTTP en cualquier endpoint.
 */
function method(string ...$esperados): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        json_headers();
        http_response_code(204);
        exit;
    }
    if (!in_array($_SERVER['REQUEST_METHOD'], $esperados, true)) {
        fail('Metodo no permitido', 405);
    }
}

/* ------------------------------------------------------------------
 * Sesion (cookie httpOnly + SameSite)
 *
 * Por defecto la sesion se guarda en PostgreSQL (tabla `sesiones`) para
 * que funcione en entornos serverless como Vercel, donde el disco es de
 * solo lectura y cada invocacion puede caer en una instancia distinta.
 * SESSION_DRIVER=file vuelve al almacenamiento en ficheros (XAMPP/clasico).
 * ------------------------------------------------------------------ */
final class SesionEnBD implements SessionHandlerInterface
{
    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string
    {
        try {
            $fila = db_row('SELECT datos FROM sesiones WHERE id = ? AND expira > now()', [$id]);
            return $fila ? (string) $fila['datos'] : '';
        } catch (Throwable $e) {
            return '';
        }
    }

    public function write(string $id, string $datos): bool
    {
        try {
            db_run(
                "INSERT INTO sesiones (id, datos, expira) VALUES (?, ?, now() + interval '24 hours')
                 ON CONFLICT (id) DO UPDATE SET datos = EXCLUDED.datos, expira = EXCLUDED.expira",
                [$id, $datos]
            );
            return true;
        } catch (Throwable $e) {
            return false;
        }
    }

    public function destroy(string $id): bool
    {
        try {
            db_exec('DELETE FROM sesiones WHERE id = ?', [$id]);
        } catch (Throwable $e) {
            // ignorar: la sesion caducara igualmente
        }
        return true;
    }

    public function gc(int $max_lifetime): int|false
    {
        try {
            return db_exec('DELETE FROM sesiones WHERE expira < now()');
        } catch (Throwable $e) {
            return 0;
        }
    }
}

function session_boot(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $params = [
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ];
    session_name(env('SESSION_NAME', 'gineco_session'));
    session_set_cookie_params($params);

    if (env('SESSION_DRIVER', 'db') === 'db') {
        session_set_save_handler(new SesionEnBD(), true);
    }

    session_start();
}

function csrf_token(): string
{
    session_boot();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['csrf'];
}

function csrf_check(): void
{
    session_boot();
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_REQUEST['csrf'] ?? '');
    if (empty($_SESSION['csrf']) || !hash_equals((string) $_SESSION['csrf'], (string) $sent)) {
        fail('Token de seguridad invalido', 419);
    }
}

/* ------------------------------------------------------------------
 * Utilidades
 * ------------------------------------------------------------------ */
function only(array $data, array $campos): array
{
    $out = [];
    foreach ($campos as $campo) {
        if (array_key_exists($campo, $data)) {
            $out[$campo] = $data[$campo];
        }
    }
    return $out;
}

function str_or_null(mixed $v): ?string
{
    if ($v === null) {
        return null;
    }
    $v = trim((string) $v);
    return $v === '' ? null : $v;
}

function num_or_null(mixed $v): ?float
{
    if ($v === null || $v === '') {
        return null;
    }
    $n = preg_replace('/[^0-9.\-]/', '', (string) $v);
    return ($n === '' || $n === '.' || $n === '-') ? null : (float) $n;
}

function int_or_null(mixed $v): ?int
{
    $n = num_or_null($v);
    return $n === null ? null : (int) round($n);
}

function log_actividad(?int $usuarioId, string $accion, string $detalle = ''): void
{
    try {
        db_exec(
            'INSERT INTO actividad (usuario_id, accion, detalle) VALUES (?, ?, ?)',
            [$usuarioId, $accion, $detalle]
        );
    } catch (Throwable $e) {
        // la auditoria nunca debe romper la operacion principal
    }
}

/**
 * Quita acentos y pasa a minusculas (busquedas amigables).
 */
function texto_normalizado(string $s): string
{
    $s = strtr($s, [
        'á' => 'a', 'à' => 'a', 'ä' => 'a', 'Á' => 'A', 'À' => 'A', 'Ä' => 'A',
        'é' => 'e', 'è' => 'e', 'É' => 'E', 'È' => 'E',
        'í' => 'i', 'ì' => 'i', 'Í' => 'I', 'Ì' => 'I',
        'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'Ó' => 'O', 'Ò' => 'O', 'Ö' => 'O',
        'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'Ú' => 'U', 'Ù' => 'U', 'Ü' => 'U',
        'ñ' => 'n', 'Ñ' => 'N',
    ]);
    return mb_strtolower(trim($s));
}

/**
 * Expresion SQL equivalente a texto_normalizado() para una columna.
 * Permite buscar "suarez" encontrando "Suarez" y "suárez".
 */
function sql_normalizado(string $columna): string
{
    return "lower(translate({$columna}, 'áàäéèíìóòöúùüñÁÀÄÉÈÍÌÓÒÖÚÙÜÑ', 'aaaeeiiooouuunAAAEEIIOOOUUUN'))";
}
