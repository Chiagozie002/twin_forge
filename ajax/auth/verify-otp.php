<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/_lib.php';
/* POST ajax/auth/verify-otp.php {email, otp}  (public, CSRF) -> {success, data:{reset_token}}
   Step 2 of 3. The code works once, for 10 minutes, with at most 5 wrong tries. Unknown email, wrong code and expired code all give the SAME
   answer. A successful check returns a one-time reset token (valid 15 minutes); only its hash is stored. */
require_method('POST'); csrf_check();
$in = input(); $email = strtolower(trim((string)($in['email'] ?? ''))); $otp = trim((string)($in['otp'] ?? ''));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $otp)) respond(false, 'Enter the 6-digit code.', [], ['otp' => 'Enter the 6-digit code.'], 422);
const BAD_CODE = 'That code is incorrect or has expired.';
const MAX_ATTEMPTS = 5;
try {
    if (rate_limited(ip_bucket('ver-ip:'), 30, 3600) || rate_limited(email_bucket('ver-mail:', $email), 10, 3600)) respond(false, 'Too many attempts. Please try again in a while.', [], [], 429);   // caps guessing even under parallel requests
    $st = db()->prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1'); $st->execute([$email]); $u = $st->fetch();
    $row = null;
    if ($u) {
        $st = db()->prepare('SELECT id, otp_hash, attempts FROM password_resets WHERE user_id = ? AND used_at IS NULL AND token_hash IS NULL AND expires_at > ? ORDER BY id DESC LIMIT 1');
        $st->execute([$u['id'], date('Y-m-d H:i:s')]); $row = $st->fetch() ?: null;
    }
    $ok = password_verify($otp, $row['otp_hash'] ?? password_hash('timing-equaliser', PASSWORD_DEFAULT)) && $row;       // always spends the same time
    if (!$ok) {
        if ($row) { $a = (int)$row['attempts'] + 1; db()->prepare('UPDATE password_resets SET attempts = ?, used_at = ? WHERE id = ?')->execute([$a, $a >= MAX_ATTEMPTS ? date('Y-m-d H:i:s') : null, $row['id']]); }   // the 5th wrong try kills the code
        respond(false, BAD_CODE, [], ['otp' => BAD_CODE], 422);
    }
    $token = bin2hex(random_bytes(32));
    db()->prepare('UPDATE password_resets SET token_hash = ?, token_expires_at = ? WHERE id = ?')->execute([hash('sha256', $token), date('Y-m-d H:i:s', time() + 900), $row['id']]);   // the code is now spent
    respond(true, 'Code verified.', ['reset_token' => $token]);
} catch (Throwable $e) { error_log('verify-otp.php: ' . $e->getMessage()); respond(false, 'Something went wrong. Please try again later.', [], [], 500); }
