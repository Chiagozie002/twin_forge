<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/auth/logout.php (+ X-CSRF-Token). Called only after the user confirms in the logout modal. */
require_method('POST');
require_login(); csrf_check();
$_SESSION = [];
if (ini_get('session.use_cookies')) { $c = session_get_cookie_params(); setcookie(session_name(), '', time() - 3600, $c['path'], $c['domain'], $c['secure'], $c['httponly']); }
session_destroy();
respond(true, 'You have been signed out.', ['redirect' => 'cpanel/login.html']);
