<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* GET ajax/messages/list.php [login] -> {data:{items:[{id,name,email,subject,message,created_at}]}} newest first (capped at 500, no pagination needed). */
require_method('GET'); require_login();
try { respond(true, 'OK', ['items' => db()->query('SELECT id, name, email, subject, message, created_at FROM messages ORDER BY created_at DESC LIMIT 500')->fetchAll()]); }
catch (Throwable $ex) { error_log('messages/list.php: ' . $ex->getMessage()); respond(false, 'Could not load messages.', [], [], 500); }
