<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/_lib.php';
/* POST ajax/settings/update-founder-bios.php {bio_1, bio_2}. Names/photos/roles live in each founder profile, not here.   [login + CSRF] */
require_method('POST'); require_login(); csrf_check();
$in = input(); $e = [];
$b1 = setting_text($in, 'bio_1', 10, 600, 'Biography', $e); $b2 = setting_text($in, 'bio_2', 10, 600, 'Biography', $e);
if ($e) respond(false, 'Please fix the highlighted fields.', [], $e, 422);
try {
    setting_set('bio_1', $b1); setting_set('bio_2', $b2);
    respond(true, 'Founder biographies saved.');
} catch (Throwable $ex) { error_log('settings/update-founder-bios: ' . $ex->getMessage()); respond(false, 'Could not save. Please try again.', [], [], 500); }
