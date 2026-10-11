<?php
/** POST /api/logout */
require __DIR__ . '/../lib/init.php';

method('POST', 'OPTIONS');

logout();
json_out(['ok' => true]);
