<?php
declare(strict_types=1);
/* Shared bootstrap for every endpoint.
   DEPLOY TODO (do these before going live):
   [ ] Needs PHP 8.1+ with extensions: pdo_mysql, mbstring, fileinfo.
   [ ] Replace DB_DSN / DB_USER / DB_PASS / BUSINESS_EMAIL below. Better: read them from environment variables or a file OUTSIDE the web root.
   [ ] Import database/schema.sql, then create the two founder accounts (command is in schema.sql).
   [ ] Serve over HTTPS (session cookies switch to "secure" automatically).
   [ ] Uploads: make uploads/ writable by PHP, and make sure scripts cannot run there (uploads/.htaccess for Apache; Nginx needs a location rule).
   [ ] PHP limits: the app has no image size limit, so only PHP's own limits apply: upload_max_filesize / post_max_size (ajax/.user.ini sets 64M / 70M on most shared hosts).
   [ ] Mail: replace mail() in messages/submit.php with authenticated SMTP (e.g. PHPMailer).
   [ ] Add per-IP rate limiting for login and contact (currently per-session only). */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
const DB_DSN = 'mysql:host=localhost;dbname=twin_forge;charset=utf8mb4';
const DB_USER = 'CHANGE_ME';
const DB_PASS = 'CHANGE_ME';
const BUSINESS_EMAIL = 'hello@example.com';   // TODO: real notification address

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
