<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/_lib.php';
/* POST ajax/settings/update-social-links.php {linkedin, x, github, instagram, facebook}  [login + CSRF]. Empty = not configured. */
require_method('POST'); require_login(); csrf_check();
$in = input(); $e = []; $clean = [];
foreach (['linkedin', 'x', 'github', 'instagram', 'facebook'] as $k) {
    $v = trim((string)($in[$k] ?? ''));
    if ($v !== '' && (mb_strlen($v) > 300 || !filter_var($v, FILTER_VALIDATE_URL) || !preg_match('~^https?://~i', $v))) $e[$k] = 'Enter a valid http(s) URL or leave empty.';   // blocks javascript: URLs
    $clean[$k] = $v;
}
if ($e) respond(false, 'Please fix the highlighted fields.', [], $e, 422);
try { foreach ($clean as $k => $v) setting_set("social_$k", $v); respond(true, 'Social links saved.'); }
catch (Throwable $ex) { error_log('social: ' . $ex->getMessage()); respond(false, 'Could not save. Please try again.', [], [], 500); }
