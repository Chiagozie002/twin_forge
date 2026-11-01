<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/messages/submit.php  (public)
   In : {name, email, subject, message, website(honeypot)}   Out: {success, message, data:{id}} */
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

// 3. Basic rate limit: one message per 30 seconds per session. TODO: add per-IP limiting (DB or Redis) too.
start_session();
if (isset($_SESSION['last_msg']) && time() - $_SESSION['last_msg'] < 30) respond(false, 'Please wait a moment before sending another message.', [], [], 429);

try {
    // 4. Prepared statement = no SQL injection. Output is escaped later, where it is displayed.
    $st = db()->prepare('INSERT INTO messages (name, email, subject, message, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())');
    $st->execute([$name, $email, $subject, $message]);
    $id = (int)db()->lastInsertId();
    $_SESSION['last_msg'] = time();

    // 5. Notify the business. CR/LF stripped from header values to block header injection.
    $clean = fn(string $s): string => str_replace(["\r", "\n"], ' ', $s);
    @mail(BUSINESS_EMAIL, '[Twin Forge] ' . $clean($subject), "From: {$clean($name)} <{$clean($email)}>\n\n$message",
          'From: no-reply@' . ($_SERVER['SERVER_NAME'] ?? 'localhost') . "\r\nReply-To: " . $clean($email));   // TODO: swap for authenticated SMTP (PHPMailer)

    respond(true, 'Your message has been received. We will reply by email.', ['id' => $id], [], 201);
} catch (Throwable $e) {
    error_log('submit.php: ' . $e->getMessage());     // log details server-side only
    respond(false, 'Something went wrong. Please try again later.', [], [], 500);
}
