<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/../mailer.php'; require __DIR__ . '/_lib.php';
/* POST ajax/auth/reset-password.php {token, new_password, confirm_password}  (public, CSRF, needs the token from verify-otp.php)
   Step 3 of 3. The token works once and expires 15 minutes after the code was verified. Saving a new password also cancels every other open reset
   for that account, and the owner gets a "your password was changed" email. */
require_method('POST'); csrf_check();
$in = input(); $token = (string)($in['token'] ?? ''); $new = (string)($in['new_password'] ?? ''); $con = (string)($in['confirm_password'] ?? '');
const EXPIRED = 'This reset session has expired. Please start again.';
if (!preg_match('/^[a-f0-9]{64}$/', $token)) respond(false, EXPIRED, [], ['token' => EXPIRED], 422);
$e = [];
if (!password_ok($new)) $e['new_password'] = 'Use at least 10 characters with letters and numbers.';
if ($new !== $con) $e['confirm_password'] = 'Passwords do not match.';
if ($e) respond(false, 'Please fix the highlighted fields.', [], $e, 422);
$answered = false;
try {
    if (rate_limited(ip_bucket('rst-ip:'), 20, 3600)) respond(false, 'Too many attempts. Please try again in a while.', [], [], 429);
    $now = date('Y-m-d H:i:s');
    $st = db()->prepare('SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND token_expires_at > ? LIMIT 1'); $st->execute([hash('sha256', $token), $now]); $row = $st->fetch();
    if (!$row) respond(false, EXPIRED, [], ['token' => EXPIRED], 422);

    db()->beginTransaction();
    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $row['user_id']]);
    db()->prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')->execute([$now, $row['user_id']]);   // this token and any other open reset
    db()->commit();
    respond_early(true, 'Password updated. You can sign in now.'); $answered = true;

    $st = db()->prepare('SELECT name, email FROM users WHERE id = ?'); $st->execute([$row['user_id']]); $u = $st->fetch();
    if ($u) send_mail('Your Twin Forge password was changed', "Hello {$u['name']},\n\nYour password was just changed using the password-reset form.\nIf this was not you, contact the other founder and reset it again straight away.\n", '', '', $u['email']);
} catch (Throwable $ex) {
    if (db()->inTransaction()) db()->rollBack();
    error_log('reset-password.php: ' . $ex->getMessage());
    if (!$answered) respond(false, 'Something went wrong. Please try again later.', [], [], 500);
}
