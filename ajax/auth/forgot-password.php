<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/../mailer.php'; require __DIR__ . '/_lib.php';
/* POST ajax/auth/forgot-password.php {email}  (public, CSRF) -> {success, message}
   Step 1 of 3. Emails a 6-digit code (valid 10 minutes). The answer is IDENTICAL whether or not the account exists, and it is sent before the
   email is, so neither the text nor the response time reveals which emails have accounts. Every request counts toward the limits, known email or not. */
require_method('POST'); csrf_check();
$email = strtolower(trim((string)(input()['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 160) respond(false, 'Enter a valid email address.', [], ['email' => 'Enter a valid email address.'], 422);
const GENERIC_ANSWER = 'If that email belongs to an account, a 6-digit code has been sent.';
$answered = false;
try {
    if (rate_limited(ip_bucket('rec-ip:'), 10, 3600) || rate_limited(email_bucket('rec-mail:', $email), 5, 3600))
        respond(false, 'Too many requests. Please try again in a while.', [], [], 429);
    $st = db()->prepare('SELECT id, name FROM users WHERE LOWER(email) = ? LIMIT 1'); $st->execute([$email]); $u = $st->fetch();
    respond_early(true, GENERIC_ANSWER); $answered = true;      // from here on the visitor already has the answer
    if (!$u) exit;

    $now = date('Y-m-d H:i:s');
    db()->prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')->execute([$now, $u['id']]);   // a new code cancels older ones
    $otp = (string)random_int(100000, 999999);
    db()->prepare('INSERT INTO password_resets (user_id, otp_hash, attempts, expires_at, created_at) VALUES (?, ?, 0, ?, ?)')
        ->execute([$u['id'], password_hash($otp, PASSWORD_DEFAULT), date('Y-m-d H:i:s', time() + 600), $now]);        // only a HASH of the code is stored
    db()->prepare('DELETE FROM password_resets WHERE created_at < ?')->execute([date('Y-m-d H:i:s', time() - 86400)]);   // housekeeping

    $body = "Hello {$u['name']},\n\nYour Twin Forge password reset code is:\n\n    $otp\n\nIt expires in 10 minutes and works once.\nIf you did not ask to reset your password, you can ignore this email: your password has not changed.\n";
    if (!send_mail('Your Twin Forge password reset code', $body, '', '', $email)) error_log('forgot-password.php: the code email could not be sent (check EMAIL SETTINGS in ajax/config.php)');
} catch (Throwable $e) {
    error_log('forgot-password.php: ' . $e->getMessage());
    if (!$answered) respond(false, 'Something went wrong. Please try again later.', [], [], 500);
}
