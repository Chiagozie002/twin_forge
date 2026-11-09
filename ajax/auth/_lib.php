<?php
declare(strict_types=1);
/* Helpers for the password-recovery endpoints (underscore = not an endpoint). */

/* Counts one hit on $bucket and says whether the limit ($max hits per $windowSec seconds) is now exceeded. Uses the rate_limits table. */
function rate_limited(string $bucket, int $max, int $windowSec): bool {
    $st = db()->prepare('SELECT COUNT(*) FROM rate_limits WHERE bucket = ? AND created_at > ?');
    $st->execute([$bucket, date('Y-m-d H:i:s', time() - $windowSec)]);
    if ((int)$st->fetchColumn() >= $max) return true;
    db()->prepare('INSERT INTO rate_limits (bucket, created_at) VALUES (?, ?)')->execute([$bucket, date('Y-m-d H:i:s')]);
    if (random_int(1, 50) === 1) db()->prepare('DELETE FROM rate_limits WHERE created_at < ?')->execute([date('Y-m-d H:i:s', time() - 86400)]);   // housekeeping
    return false;
}
function ip_bucket(string $prefix): string { return $prefix . hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '')); }
function email_bucket(string $prefix, string $email): string { return $prefix . hash('sha256', $email); }
/* Same password rule as profile/change-password.php and the pages: 10+ characters, letters AND numbers. */
function password_ok(string $p): bool { return strlen($p) >= 10 && strlen($p) <= 200 && preg_match('/[A-Za-z]/', $p) && preg_match('/\d/', $p); }
