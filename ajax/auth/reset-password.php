<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/auth/reset-password.php {token, new_password, confirm_password}  (public, token required)
   STATUS: NOT IMPLEMENTED. Returns HTTP 501 so the frontend can never believe a reset worked.
   TODO (backend):
   [ ] Call csrf_check() first (the recovery pages fetch their token from GET ajax/auth/login.php).
   [ ] Look up the token HASH; reject if unknown, used or expired.
   [ ] Enforce the same password policy as profile/change-password.php (10+ chars, letters and numbers; new === confirm).
   [ ] UPDATE users SET password_hash = password_hash(new, PASSWORD_DEFAULT); mark the token used; delete all other reset tokens for that user.
   [ ] Invalidate existing sessions for that user if you add a sessions table; email the user "your password was changed".
   [ ] Respond success, then the frontend sends the user to cpanel/login.html.
*/
require_method('POST');
respond(false, 'Password recovery is not available yet.', [], [], 501);
