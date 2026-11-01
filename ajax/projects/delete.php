<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/projects/delete.php {id} [login + CSRF]. SOFT delete only: status -> 'trashed'. Permanent removal is a separate endpoint. */
require_method('POST'); require_login(); csrf_check();
$id = (int)(input()['id'] ?? 0);
if ($id < 1) respond(false, 'Invalid project.', [], [], 422);
try {
    $st = db()->prepare("UPDATE projects SET status = 'trashed' WHERE id = ? AND status = 'active'"); $st->execute([$id]);
    if (!$st->rowCount()) respond(false, 'Project not found or already in Trash.', [], [], 404);
    respond(true, 'Project moved to Trash.', ['id' => $id]);
} catch (Throwable $ex) { error_log('delete.php: ' . $ex->getMessage()); respond(false, 'Could not delete the project.', [], [], 500); }
