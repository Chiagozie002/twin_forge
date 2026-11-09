<?php
declare(strict_types=1);
/* Sends the contact-form notification email. All settings are in ajax/config.php (EMAIL SETTINGS). This file only defines functions; it is not an endpoint. */
if (!defined('MAIL_TRANSPORT')) { http_response_code(403); exit; }

/* Header values must never contain line breaks: that is how "header injection" adds hidden Bcc recipients. */
function mail_header_safe(string $s): string { return trim(str_replace(["\r", "\n", "\0"], ' ', $s)); }
/* Non-ASCII text (names like "Ọkafọr", ₦, emoji) must be MIME-encoded in headers or it arrives garbled. */
function mail_encode(string $s): string {
    $s = mail_header_safe($s);
    return preg_match('/[^\x20-\x7E]/', $s) ? mb_encode_mimeheader($s, 'UTF-8', 'B', "\r\n") : $s;
}
function mail_address(string $addr, string $name = ''): string {
    $addr = mail_header_safe($addr); $name = mail_header_safe($name);
    if ($name === '') return $addr;
    return (preg_match('/[^\x20-\x7E]/', $name) ? mail_encode($name) : '"' . addcslashes($name, '"\\') . '"') . " <$addr>";
}

/* Sends one email. Default recipient: MAIL_TO (the site owner). Pass $to for someone else (e.g. a founder's password-reset code).
   $replyTo is the visitor's (already validated) address so you can simply press Reply. Returns true if it was handed over. */
function send_mail(string $subject, string $body, string $replyTo = '', string $replyName = '', ?string $to = null): bool {
    $to = $to ?? MAIL_TO;
    foreach (array_filter(array_map('trim', explode(',', $to))) as $addr) if (!filter_var($addr, FILTER_VALIDATE_EMAIL)) { error_log('mailer: refused an invalid recipient address'); return false; }
    $headers = ['MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', 'From: ' . mail_address(MAIL_FROM, MAIL_FROM_NAME)];
    if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $headers[] = 'Reply-To: ' . mail_address($replyTo, $replyName);
    $subjectEnc = mail_encode($subject);
    $payload = chunk_split(base64_encode($body), 76, "\r\n");          // base64 body = safe for any language and any line length
    try {
        if (MAIL_TRANSPORT === 'smtp') return smtp_deliver($to, MAIL_FROM, $subjectEnc, $headers, $payload);
        return mail($to, $subjectEnc, $payload, implode("\r\n", $headers));
    } catch (Throwable $e) { error_log('mailer: ' . $e->getMessage()); return false; }
}

/* Minimal SMTP client (no libraries needed): connect, STARTTLS or SSL, AUTH LOGIN, send. Throws on any SMTP error. */
function smtp_deliver(string $to, string $from, string $subject, array $headers, string $payload): bool {
    $ctx = stream_context_create(['ssl' => ['verify_peer' => SMTP_VERIFY_TLS, 'verify_peer_name' => SMTP_VERIFY_TLS, 'peer_name' => SMTP_HOST]]);
    $fp = @stream_socket_client((SMTP_SECURE === 'ssl' ? 'ssl://' : 'tcp://') . SMTP_HOST . ':' . SMTP_PORT, $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) throw new RuntimeException("SMTP connect to " . SMTP_HOST . ':' . SMTP_PORT . " failed: $errstr ($errno)");
    stream_set_timeout($fp, 10);
    $read = function () use ($fp): string { $out = ''; while (($l = fgets($fp, 1024)) !== false) { $out .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; } return $out; };
    $send = function (string $cmd, array $ok) use ($fp, $read): string {
        fwrite($fp, $cmd . "\r\n"); $r = $read();
        if (!in_array((int)substr($r, 0, 3), $ok, true)) throw new RuntimeException('SMTP error after "' . explode(' ', $cmd)[0] . '": ' . trim($r));
        return $r;
    };
    $r = $read(); if (substr($r, 0, 3) !== '220') throw new RuntimeException('SMTP greeting failed: ' . trim($r));
    $host = preg_replace('/[^A-Za-z0-9.\-]/', '', (string)($_SERVER['SERVER_NAME'] ?? 'localhost')) ?: 'localhost';
    $send("EHLO $host", [250]);
    if (SMTP_SECURE === 'tls') {
        $send('STARTTLS', [220]);
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('SMTP STARTTLS handshake failed');
        $send("EHLO $host", [250]);
    }
    if (SMTP_USER !== '') { $send('AUTH LOGIN', [334]); $send(base64_encode(SMTP_USER), [334]); $send(base64_encode(SMTP_PASS), [235]); }
    $send('MAIL FROM:<' . mail_header_safe($from) . '>', [250]);
    foreach (array_filter(array_map('trim', explode(',', $to))) as $rcpt) $send('RCPT TO:<' . mail_header_safe($rcpt) . '>', [250, 251]);
    $send('DATA', [354]);
    $head = array_merge(['Date: ' . date('r'), 'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $host . '>', 'To: ' . mail_header_safe($to), 'Subject: ' . $subject], $headers);
    fwrite($fp, implode("\r\n", $head) . "\r\n\r\n" . $payload . "\r\n.\r\n");   // base64 never starts a line with ".", so no dot-stuffing is needed
    $r = $read(); if (substr($r, 0, 3) !== '250') throw new RuntimeException('SMTP rejected the message: ' . trim($r));
    @fwrite($fp, "QUIT\r\n"); fclose($fp);
    return true;
}
