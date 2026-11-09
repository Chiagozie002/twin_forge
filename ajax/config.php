<?php
declare(strict_types=1);
/* Shared bootstrap for every endpoint.
   DEPLOY TODO (do these before going live):
   [ ] Needs PHP 8.1+ with extensions: pdo_mysql, mbstring, fileinfo.
   [ ] Replace DB_DSN / DB_USER / DB_PASS below, and fill in the EMAIL SETTINGS block. Better: read them from environment variables or a file OUTSIDE the web root.
   [ ] Import database/schema.sql, then create the two founder accounts (command is in schema.sql).
   [ ] Serve over HTTPS (session cookies switch to "secure" automatically).
   [ ] Uploads: make uploads/ writable by PHP, and make sure scripts cannot run there (uploads/.htaccess for Apache; Nginx needs a location rule).
   [ ] PHP limits: the app has no image size limit, so only PHP's own limits apply: upload_max_filesize / post_max_size (ajax/.user.ini sets 64M / 70M on most shared hosts).
   [ ] Mail: set MAIL_TRANSPORT to 'smtp' and fill in the SMTP_ settings (the default 'mail' often ends up in spam or never arrives).
   [ ] Login still has per-session rate limiting only (the contact form also limits per IP). */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
const DB_DSN = 'mysql:host=localhost;dbname=twin_forge;charset=utf8mb4';
const DB_USER = 'CHANGE_ME';
const DB_PASS = 'CHANGE_ME';

/* ===== EMAIL SETTINGS =====
   The contact form saves every message to the database AND emails it to MAIL_TO. The code that sends it is ajax/mailer.php.
   MAIL_TRANSPORT:  'mail' = PHP's built-in mail() (only works if your server has a mail system; often lands in spam)
                    'smtp' = send through a real mailbox (Gmail, Zoho, your hosting email...). RECOMMENDED for a live site. */
const MAIL_TRANSPORT = 'mail';
const MAIL_TO        = 'hello@example.com';      // where contact-form messages are delivered (one address, or several separated by commas)
const MAIL_FROM      = 'no-reply@example.com';   // the "From" address: use an address on YOUR domain (or the SMTP account itself) so spam filters trust it
const MAIL_FROM_NAME = 'Twin Forge Website';
// Used only when MAIL_TRANSPORT = 'smtp':
const SMTP_HOST       = 'smtp.example.com';
const SMTP_PORT       = 587;          // 587 with 'tls', or 465 with 'ssl'
const SMTP_SECURE     = 'tls';        // 'tls' = STARTTLS (port 587) | 'ssl' = implicit SSL (port 465) | '' = no encryption (local testing only)
const SMTP_USER       = '';           // usually your full email address; leave '' if the server needs no login
const SMTP_PASS       = '';           // Gmail: use an "App password", not your normal password
const SMTP_VERIFY_TLS = true;         // keep true; false only for a local test server with a self-signed certificate
const CONTACT_MAX_PER_HOUR = 5;       // spam guard: most messages one IP address can send per hour
const APP_TIMEZONE   = 'Africa/Lagos';
date_default_timezone_set(APP_TIMEZONE);

/* Consistent JSON contract: {success, message, data, errors}. */
function respond(bool $ok, string $message, array $data = [], array $errors = [], int $code = 200): never {
    http_response_code($code);
    echo json_encode(['success' => $ok, 'message' => $message, 'data' => (object)$data, 'errors' => (object)$errors], JSON_UNESCAPED_UNICODE);
    exit;
}
ini_set('display_errors', '0'); ini_set('log_errors', '1'); error_reporting(E_ALL);   // never show PHP errors to visitors
set_exception_handler(function (Throwable $e): void {                                    // any uncaught error becomes a clean JSON 500
    error_log('Uncaught: ' . $e->getMessage()); http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Something went wrong. Please try again later.', 'data' => new stdClass, 'errors' => new stdClass]);
});
/* Sends the JSON answer NOW and lets the script keep working (e.g. sending an email). The visitor never waits for the mail server, and the
   response time cannot reveal whether an account exists. Does NOT exit: do your slow work after calling it. */
function respond_early(bool $ok, string $message, array $data = [], int $code = 200): void {
    ignore_user_abort(true);
    $json = json_encode(['success' => $ok, 'message' => $message, 'data' => (object)$data, 'errors' => new stdClass], JSON_UNESCAPED_UNICODE);
    http_response_code($code); header('Content-Length: ' . strlen($json)); header('Connection: close'); echo $json;
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request(); else { while (ob_get_level() > 0) ob_end_flush(); flush(); }
}
function db(): PDO {
    static $pdo = null;
    return $pdo ??= new PDO(DB_DSN, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,           // real prepared statements
    ]);
}
/* Accepts a JSON body (our fetch helper) or a normal form post. */
function input(): array {
    $json = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($json) ? $json : $_POST;
}
function require_method(string $m): void {
    if ($_SERVER['REQUEST_METHOD'] !== $m) { header('Allow: ' . $m); respond(false, 'Method not allowed.', [], [], 405); }
}

/* ---- Sessions and CSRF (used by auth and every state-changing endpoint) ---- */
function start_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
        session_start();
    }
}
function csrf_token(): string { start_session(); return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function csrf_check(): void {
    start_session();
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) respond(false, 'Security check failed. Please refresh the page and try again.', [], [], 419);
}
/* Call at the top of every protected endpoint: returns the logged-in user id or stops with 401. */
function require_login(): int {
    header('Cache-Control: no-store');          // never cache authenticated responses
    start_session();
    if (empty($_SESSION['uid'])) respond(false, 'Please sign in to continue.', [], [], 401);
    return (int)$_SESSION['uid'];
}
