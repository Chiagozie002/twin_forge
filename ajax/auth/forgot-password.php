<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/auth/forgot-password.php {email}  (public) -> {success, message}
   STATUS: NOT IMPLEMENTED. Returns HTTP 501 so the frontend can never believe a reset worked.
   TODO (backend):
   [ ] Call csrf_check() first (the recovery pages fetch their token from GET ajax/auth/login.php).
   [ ] Validate the email format. Rate-limit by IP AND by email (e.g. 5 requests / hour).
   [ ] ALWAYS answer with the same generic message ("If that email exists, a code was sent") so attackers cannot discover accounts.
   [ ] If the user exists: create a 6-digit code with random_int(100000, 999999).
   [ ] Store only a HASH of the code (password_hash or hash_hmac) in table password_resets(user_id, otp_hash, expires_at = now + 10 min, attempts = 0, used_at NULL). Invalidate older codes for that user.
   [ ] Email the code with authenticated SMTP (PHPMailer). Never put the code in the JSON response.
   [ ] Table SQL is commented at the bottom of database/schema.sql.
*/
require_method('POST');
respond(false, 'Password recovery is not available yet.', [], [], 501);
