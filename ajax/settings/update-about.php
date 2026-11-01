<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/_lib.php';
/* POST ajax/settings/update-about.php {about}   [login + CSRF] */
require_method('POST'); require_login(); csrf_check();
$in = input(); $e = [];
$about = setting_text($in, 'about', 20, 2000, 'About text', $e);
if ($e) respond(false, 'Please fix the highlighted fields.', [], $e, 422);
try {
    setting_set('about', $about);
    respond(true, 'About section saved.');
} catch (Throwable $ex) { error_log('settings/update-about: ' . $ex->getMessage()); respond(false, 'Could not save. Please try again.', [], [], 500); }
