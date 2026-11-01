<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/_lib.php';
/* POST ajax/settings/update-mission-vision.php {mission, vision}   [login + CSRF] */
require_method('POST'); require_login(); csrf_check();
$in = input(); $e = [];
$mission = setting_text($in, 'mission', 10, 600, 'Mission', $e); $vision = setting_text($in, 'vision', 10, 600, 'Vision', $e);
if ($e) respond(false, 'Please fix the highlighted fields.', [], $e, 422);
try {
    setting_set('mission', $mission); setting_set('vision', $vision);
    respond(true, 'Mission and vision saved.');
} catch (Throwable $ex) { error_log('settings/update-mission-vision: ' . $ex->getMessage()); respond(false, 'Could not save. Please try again.', [], [], 500); }
