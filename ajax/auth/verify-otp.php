<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/auth/verify-otp.php {email, otp}  (public) -> {success, data:{reset_token}}
   STATUS: NOT IMPLEMENTED. Returns HTTP 501 so the frontend can never believe a reset worked.
   TODO (backend):
   [ ] Call csrf_check() first (the recovery pages fetch their token from GET ajax/auth/login.php).
   [ ] Look up the newest unused, unexpired code for that email. Reject expired codes.
   [ ] Count attempts; after 5 wrong tries invalidate the code (and lock further tries for a while).
   [ ] Compare with password_verify / hash_equals (constant time).
   [ ] On success: mark the code used, create a random reset token (bin2hex(random_bytes(32))), store its HASH with a 15 minute expiry, return the plain token once.
   [ ] Same generic error message for unknown email / wrong code / expired code.
*/
require_method('POST');
respond(false, 'Password recovery is not available yet.', [], [], 501);
