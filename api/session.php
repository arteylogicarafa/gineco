<?php
/** GET /api/session - usuario actual + token csrf */
require __DIR__ . '/../lib/init.php';

method('GET', 'OPTIONS');

$user = current_user();
if (!$user) {
    fail('No autenticado', 401);
}

json_out([
    'ok'   => true,
    'user' => user_payload($user),
    'csrf' => $_SESSION['csrf'] ?? '',
]);
