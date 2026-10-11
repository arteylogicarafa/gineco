<?php
/** POST /api/logout */
require __DIR__ . '/_lib/init.php';

method('POST', 'OPTIONS');

logout();
json_out(['ok' => true]);
