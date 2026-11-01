<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/messages/delete.php {id} [login + CSRF]. Permanent (messages have no Trash). */
require_method('POST'); require_login(); csrf_check();
$id = (int)(input()['id'] ?? 0);
if ($id < 1) respond(false, 'Invalid message.', [], [], 422);
try {
    $st = db()->prepare('DELETE FROM messages WHERE id = ?'); $st->execute([$id]);
    if (!$st->rowCount()) respond(false, 'Message not found.', [], [], 404);
    respond(true, 'Message deleted.', ['id' => $id]);
} catch (Throwable $ex) { error_log('messages/delete.php: ' . $ex->getMessage()); respond(false, 'Could not delete the message.', [], [], 500); }
