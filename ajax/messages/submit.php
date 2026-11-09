<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/../mailer.php';
/* POST ajax/messages/submit.php  (public)
   In : {name, email, subject, message, website(honeypot)}   Out: {success, message, data:{id}}
   Flow: honeypot -> validate -> rate limits -> save to the database -> email MAIL_TO (settings in ajax/config.php, sender in ajax/mailer.php).
   The message is ALWAYS saved first; if the email cannot be sent, the failure is written to the PHP error log and the visitor is not affected. */
require_method('POST');
$in = input();

// 1. Spam: the honeypot must be empty. Bots get a fake success so they learn nothing.
if (!empty($in['website'])) respond(true, 'Your message has been received.');

// 2. Server-side validation (never trust the browser).
$v = fn(string $k): string => trim((string)($in[$k] ?? ''));
$name = $v('name'); $email = $v('email'); $subject = $v('subject'); $message = $v('message');
$err = [];
if (mb_strlen($name) < 2 || mb_strlen($name) > 120)         $err['name'] = 'Name must be 2-120 characters.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 160) $err['email'] = 'Enter a valid email address.';
if (mb_strlen($subject) < 3 || mb_strlen($subject) > 160)   $err['subject'] = 'Subject must be 3-160 characters.';
if (mb_strlen($message) < 10 || mb_strlen($message) > 4000) $err['message'] = 'Message must be 10-4000 characters.';
if ($err) respond(false, 'Please fix the highlighted fields.', [], $err, 422);

// 3. Rate limits: one message per 30 seconds per session, and CONTACT_MAX_PER_HOUR per hour per IP address (counted in the database).
start_session();
if (isset($_SESSION['last_msg']) && time() - $_SESSION['last_msg'] < 30) respond(false, 'Please wait a moment before sending another message.', [], [], 429);
$ipHash = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? ''));          // only a hash of the IP is stored

try {
    $st = db()->prepare('SELECT COUNT(*) FROM messages WHERE ip_hash = ? AND created_at > ?');
    $st->execute([$ipHash, date('Y-m-d H:i:s', time() - 3600)]);
    if ((int)$st->fetchColumn() >= CONTACT_MAX_PER_HOUR) respond(false, 'You have sent several messages recently. Please try again later.', [], [], 429);

    // 4. Save first. Prepared statement = no SQL injection (output is escaped later, where it is displayed).
    $now = date('Y-m-d H:i:s');
    db()->prepare('INSERT INTO messages (name, email, subject, message, is_read, ip_hash, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
        ->execute([$name, $email, $subject, $message, $ipHash, $now]);
    $id = (int)db()->lastInsertId();
    $_SESSION['last_msg'] = time();

    // 5. Email it to the business (Reply goes straight to the visitor).
    $body = "New message from the website contact form\n\nName:     $name\nEmail:    $email\nSubject:  $subject\nReceived: $now\n\n----------------------------------------\n$message\n----------------------------------------\nPress Reply to answer $name directly.\n";
    if (!send_mail('[Twin Forge] ' . $subject, $body, $email, $name))
        error_log("submit.php: message #$id was saved but the notification email could not be sent (check EMAIL SETTINGS in ajax/config.php)");

    respond(true, 'Your message has been received. We will reply by email.', ['id' => $id], [], 201);
} catch (Throwable $e) {
    error_log('submit.php: ' . $e->getMessage());     // log details server-side only
    respond(false, 'Something went wrong. Please try again later.', [], [], 500);
}
