<?php
/** POST /api/login  {usuario, password} */
require __DIR__ . '/../lib/init.php';

method('POST', 'OPTIONS');

$in = json_in();
$user = login_attempt((string) ($in['usuario'] ?? ''), (string) ($in['password'] ?? ''));

json_out([
    'ok'   => true,
    'user' => user_payload($user),
    'csrf' => $_SESSION['csrf'] ?? '',
]);
