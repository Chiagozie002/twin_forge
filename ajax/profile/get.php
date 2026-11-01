<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* GET ajax/profile/get.php [login] -> {data:{user:{id,name,email,role_title}, csrf}}. Admin pages call this on load: it is both the auth guard and the CSRF source. */
require_method('GET'); $uid = require_login();
try {
    $st = db()->prepare('SELECT id, name, email, role_title, picture_url FROM users WHERE id = ?'); $st->execute([$uid]); $u = $st->fetch();
    if (!$u) { $_SESSION = []; respond(false, 'Please sign in to continue.', [], [], 401); }
    respond(true, 'OK', ['user' => $u, 'csrf' => csrf_token()]);
} catch (Throwable $ex) { error_log('profile/get.php: ' . $ex->getMessage()); respond(false, 'Could not load your profile.', [], [], 500); }
