<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/profile/update.php {name, email, role_title} [login + CSRF]. role_title is a PUBLIC label only: it never grants permissions. */
require_method('POST'); $uid = require_login(); csrf_check();
$in = input(); $name = trim((string)($in['name'] ?? '')); $email = trim((string)($in['email'] ?? '')); $role = trim((string)($in['role_title'] ?? '')); $e = [];
if (mb_strlen($name) < 2 || mb_strlen($name) > 120) $e['name'] = 'Name must be 2-120 characters.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 160) $e['email'] = 'Enter a valid email address.';
if (mb_strlen($role) < 2 || mb_strlen($role) > 80) $e['role_title'] = 'Role must be 2-80 characters.';
if ($e) respond(false, 'Please fix the highlighted fields.', [], $e, 422);
try {
    $st = db()->prepare('SELECT id FROM users WHERE email = ? AND id <> ?'); $st->execute([$email, $uid]);
    if ($st->fetch()) respond(false, 'Please fix the highlighted fields.', [], ['email' => 'That email is already in use.'], 422);
    db()->prepare('UPDATE users SET name = ?, email = ?, role_title = ? WHERE id = ?')->execute([$name, $email, $role, $uid]);
    respond(true, 'Profile updated.', ['user' => ['name' => $name, 'email' => $email, 'role_title' => $role]]);
} catch (Throwable $ex) { error_log('profile/update: ' . $ex->getMessage()); respond(false, 'Could not update your profile.', [], [], 500); }
