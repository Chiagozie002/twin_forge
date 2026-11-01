<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* GET  ajax/auth/login.php -> {data:{csrf}}   (token the frontend must send back)
   POST ajax/auth/login.php {email, password} + header X-CSRF-Token -> {data:{redirect}}
   Accounts are created manually by the developer (no public sign-up). */
start_session();
if ($_SERVER['REQUEST_METHOD'] === 'GET') respond(true, 'OK', ['csrf' => csrf_token()]);
require_method('POST');
csrf_check();

// 1. Throttle: 5 failures locks this session for 5 minutes. TODO: also throttle per IP in the database.
if (($_SESSION['lock_until'] ?? 0) > time()) respond(false, 'Too many attempts. Please try again in a few minutes.', [], [], 429);

// 2. Validate input shape.
$in = input(); $email = trim((string)($in['email'] ?? '')); $pass = (string)($in['password'] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $pass === '' || strlen($pass) > 200) respond(false, 'Enter a valid email and password.', [], [], 422);

try {
    $st = db()->prepare('SELECT id, password_hash FROM users WHERE email = ? LIMIT 1');   // prepared = injection-safe
    $st->execute([$email]); $u = $st->fetch();

    // 3. Always run password_verify (even for unknown emails) so response time does not reveal which emails exist.
    $hash = $u['password_hash'] ?? password_hash('timing-equaliser', PASSWORD_DEFAULT);
    if ($u && password_verify($pass, $hash)) {
        session_regenerate_id(true);                              // blocks session fixation
        $_SESSION['uid'] = (int)$u['id']; unset($_SESSION['fails'], $_SESSION['lock_until']);
        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        respond(true, 'Signed in.', ['redirect' => 'cpanel/index.html']);
    }
    $_SESSION['fails'] = ($_SESSION['fails'] ?? 0) + 1;
    if ($_SESSION['fails'] >= 5) { $_SESSION['lock_until'] = time() + 300; $_SESSION['fails'] = 0; }
    respond(false, 'Incorrect email or password.', [], [], 401);   // one generic message for both cases
} catch (Throwable $e) {
    error_log('login.php: ' . $e->getMessage());
    respond(false, 'Sign in is unavailable right now. Please try again later.', [], [], 500);
}
