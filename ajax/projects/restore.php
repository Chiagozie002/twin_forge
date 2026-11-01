<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/projects/restore.php {id} [login + CSRF]: trashed -> active (reappears on the public site). */
require_method('POST'); require_login(); csrf_check();
$id = (int)(input()['id'] ?? 0);
if ($id < 1) respond(false, 'Invalid project.', [], [], 422);
try {
    $st = db()->prepare("UPDATE projects SET status = 'active' WHERE id = ? AND status = 'trashed'"); $st->execute([$id]);
    if (!$st->rowCount()) respond(false, 'Project not found in Trash.', [], [], 404);
    respond(true, 'Project restored.', ['id' => $id]);
} catch (Throwable $ex) { error_log('restore.php: ' . $ex->getMessage()); respond(false, 'Could not restore the project.', [], [], 500); }
