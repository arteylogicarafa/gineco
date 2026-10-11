<?php
/**
 * db.php - conexion PDO a PostgreSQL (Neon o local) + helpers de consulta
 */

declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (!extension_loaded('pdo_pgsql')) {
        fail('La extension pdo_pgsql no esta habilitada en PHP. Activala en php.ini (XAMPP: extension=pdo_pgsql).', 500);
    }

    $host = env('DB_HOST', '127.0.0.1');
    $port = env('DB_PORT', '5432');
    $name = env('DB_NAME', 'gineco');
    $user = env('DB_USER', 'postgres');
    $pass = (string) env('DB_PASSWORD', '');
    $ssl  = env('DB_SSLMODE', 'disable');

    $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s;sslmode=%s', $host, $port, $name, $ssl);

    // Neon: los endpoints antiguos de libpq no envian SNI, asi que hay que
    // indicar el id del endpoint (primera parte del dominio) como parametro.
    $endpoint = preg_replace('/-pooler$/i', '', explode('.', $host)[0]);
    if (is_string($endpoint) && str_starts_with($endpoint, 'ep-')) {
        $dsn .= ';options=endpoint=' . $endpoint;
    }

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_STRINGIFY_FETCHES  => false,
        ]);
    } catch (PDOException $e) {
        $msg = env('APP_DEBUG', '0') === '1'
            ? 'No se pudo conectar a PostgreSQL: ' . $e->getMessage()
            : 'No se pudo conectar a la base de datos. Revisa la configuracion en .env';
        fail($msg, 500);
    }

    return $pdo;
}

/**
 * Prepara y ejecuta una consulta normalizando los tipos de parametro.
 * Los booleanos de PHP se envian como 'true'/'false' (aceptados por PostgreSQL)
 * porque PDO los convierte a cadena vacia por defecto.
 */
function db_run(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    foreach (array_values($params) as $i => $v) {
        $n = $i + 1;
        if (is_bool($v)) {
            $stmt->bindValue($n, $v ? 'true' : 'false', PDO::PARAM_STR);
        } elseif ($v === null) {
            $stmt->bindValue($n, null, PDO::PARAM_NULL);
        } elseif (is_int($v)) {
            $stmt->bindValue($n, $v, PDO::PARAM_INT);
        } elseif (is_float($v)) {
            $stmt->bindValue($n, $v, PDO::PARAM_STR);
        } else {
            $stmt->bindValue($n, $v, PDO::PARAM_STR);
        }
    }
    $stmt->execute();
    return $stmt;
}

/** Ejecuta una consulta SELECT y devuelve todas las filas. */
function db_rows(string $sql, array $params = []): array
{
    return db_run($sql, $params)->fetchAll();
}

/** Ejecuta una consulta SELECT y devuelve la primera fila o null. */
function db_row(string $sql, array $params = []): ?array
{
    $row = db_run($sql, $params)->fetch();
    return $row === false ? null : $row;
}

/** Ejecuta un escalar (COUNT, SUM...) y devuelve su valor o null. */
function db_scalar(string $sql, array $params = []): mixed
{
    $val = db_run($sql, $params)->fetchColumn();
    return $val === false ? null : $val;
}

/** Ejecuta INSERT/UPDATE/DELETE y devuelve el numero de filas afectadas. */
function db_exec(string $sql, array $params = []): int
{
    return db_run($sql, $params)->rowCount();
}

/** INSERT generico. Devuelve el valor de la columna $returning (por defecto id). */
function db_insert(string $tabla, array $datos, string $returning = 'id'): int
{
    $cols = array_keys($datos);
    $vals = array_fill(0, count($cols), '?');
    $sql = sprintf(
        'INSERT INTO %s (%s) VALUES (%s) RETURNING %s',
        $tabla,
        implode(', ', $cols),
        implode(', ', $vals),
        $returning
    );
    $stmt = db_run($sql, array_values($datos));
    return (int) $stmt->fetchColumn();
}

/** UPDATE generico. Devuelve filas afectadas. */
function db_update(string $tabla, array $datos, string $where, array $whereParams = []): int
{
    if (!$datos) {
        return 0;
    }
    $set = [];
    foreach (array_keys($datos) as $col) {
        $set[] = $col . ' = ?';
    }
    $sql = sprintf('UPDATE %s SET %s WHERE %s', $tabla, implode(', ', $set), $where);
    return db_exec($sql, array_merge(array_values($datos), $whereParams));
}

/** Ejecuta un callback dentro de una transaccion. Re-lanza excepciones. */
function db_transaction(callable $fn): mixed
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $result = $fn($pdo);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}
