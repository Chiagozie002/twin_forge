<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/projects/permanent-delete.php {id} [login + CSRF]. Irreversible; only works on projects already in Trash. */
require_method('POST'); require_login(); csrf_check();
$id = (int)(input()['id'] ?? 0);
if ($id < 1) respond(false, 'Invalid project.', [], [], 422);
try {
    $st = db()->prepare("SELECT image_url FROM projects WHERE id = ? AND status = 'trashed'"); $st->execute([$id]); $row = $st->fetch();
    if (!$row) respond(false, 'Only projects in Trash can be permanently deleted.', [], [], 404);
    db()->prepare('DELETE FROM projects WHERE id = ?')->execute([$id]);
    // Remove the image file too, but only if it really sits inside uploads/projects (blocks path tricks).
    $dir = realpath(__DIR__ . '/../../uploads/projects'); $file = $row['image_url'] ? realpath(__DIR__ . '/../../' . $row['image_url']) : false;
    if ($dir && $file && str_starts_with($file, $dir . DIRECTORY_SEPARATOR) && is_file($file)) @unlink($file);
    respond(true, 'Project permanently deleted.', ['id' => $id]);
} catch (Throwable $ex) { error_log('permanent-delete.php: ' . $ex->getMessage()); respond(false, 'Could not delete the project.', [], [], 500); }
