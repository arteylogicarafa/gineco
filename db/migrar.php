<?php
/**
 * db/migrar.php
 * Aplica db/schema.sql a la base de datos indicada en .env.
 * Sirve para preparar Neon (o cualquier PostgreSQL) sin usar psql.
 *
 * Uso:  php db/migrar.php
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "Este script solo puede ejecutarse desde linea de comandos.\n";
    exit(1);
}

require __DIR__ . '/../lib/init.php';

echo "== Migracion de base de datos ==\n";
echo 'Base: ' . env('DB_NAME', 'gineco') . '@' . env('DB_HOST', '(por defecto)')
    . ':' . env('DB_PORT', '5432') . '  ssl=' . env('DB_SSLMODE', 'disable') . "\n";

try {
    db();
} catch (Throwable $e) {
    echo "ERROR: no se pudo conectar.\n" . $e->getMessage() . "\n";
    exit(1);
}

/* 1) esquema */
$schema = file_get_contents(__DIR__ . '/schema.sql');
if ($schema === false) {
    echo "ERROR: no se pudo leer db/schema.sql\n";
    exit(1);
}
try {
    db()->exec($schema);
    echo "  -> esquema aplicado (tablas creadas o verificadas)\n";
} catch (Throwable $e) {
    echo 'ERROR aplicando el esquema: ' . $e->getMessage() . "\n";
    exit(1);
}

/* 2) ajustes para bases creadas con versiones anteriores */
try {
    $tipo = db_scalar("SELECT data_type FROM information_schema.columns
                        WHERE table_name = 'medicos' AND column_name = 'logo'");
    if ($tipo !== null && strtolower((string) $tipo) !== 'text') {
        db_exec('ALTER TABLE medicos ALTER COLUMN logo TYPE TEXT');
        echo "  -> columna medicos.logo ampliada a TEXT (logos embebidos)\n";
    }

    $sesiones = db_scalar("SELECT to_regclass('public.sesiones') IS NOT NULL AS ok");
    if (!$sesiones) {
        db_exec("CREATE TABLE IF NOT EXISTS sesiones (
                    id VARCHAR(128) PRIMARY KEY,
                    datos TEXT NOT NULL,
                    expira TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
                    creada TIMESTAMPTZ NOT NULL DEFAULT now())");
        echo "  -> tabla sesiones creada\n";
    }
} catch (Throwable $e) {
    echo 'Aviso: ' . $e->getMessage() . "\n";
}

$tablas = db_rows("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
echo 'Tablas: ' . implode(', ', array_column($tablas, 'tablename')) . "\n";
echo "Listo.\n";
