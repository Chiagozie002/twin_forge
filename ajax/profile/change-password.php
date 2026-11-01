<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/profile/change-password.php {current_password, new_password, confirm_password} [login + CSRF]. The current password is never sent back or prefilled. */
require_method('POST'); $uid = require_login(); csrf_check();
$in = input(); $cur = (string)($in['current_password'] ?? ''); $new = (string)($in['new_password'] ?? ''); $con = (string)($in['confirm_password'] ?? ''); $e = [];
if ($cur === '') $e['current_password'] = 'Enter your current password.';
if (strlen($new) < 10 || strlen($new) > 200 || !preg_match('/[A-Za-z]/', $new) || !preg_match('/\d/', $new)) $e['new_password'] = 'Use at least 10 characters with letters and numbers.';
if ($new !== $con) $e['confirm_password'] = 'Passwords do not match.';
if ($new !== '' && $new === $cur) $e['new_password'] = 'Choose a password different from the current one.';
if ($e) respond(false, 'Please fix the highlighted fields.', [], $e, 422);
try {
    $st = db()->prepare('SELECT password_hash FROM users WHERE id = ?'); $st->execute([$uid]);
    if (!password_verify($cur, (string)$st->fetchColumn())) respond(false, 'Please fix the highlighted fields.', [], ['current_password' => 'Current password is incorrect.'], 422);
    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $uid]);
    session_regenerate_id(true);                                  // fresh session id after a credential change
    respond(true, 'Password changed.');
} catch (Throwable $ex) { error_log('change-password: ' . $ex->getMessage()); respond(false, 'Could not change the password.', [], [], 500); }
