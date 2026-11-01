<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/_lib.php';
/* POST (multipart) ajax/projects/update.php  [login + CSRF]  Same fields as add.php plus id.
   The image is optional here (the current one is kept), BUT a project that somehow has no image must get one. */
require_method('POST'); require_login(); csrf_check(); reject_oversized_post();
$id = (int)($_POST['id'] ?? 0);
[$c, $e] = project_input($_POST);
if ($id < 1) respond(false, 'Invalid project.', [], ['id' => 'Invalid project.'], 422);
try {
    $st = db()->prepare('SELECT image_url FROM projects WHERE id = ?'); $st->execute([$id]); $row = $st->fetch();
    if (!$row) respond(false, 'Project not found.', [], [], 404);
    $img = null; $f = $_FILES['image'] ?? null;
    $has = $f && ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
    if ($has) { if (!$e) $img = save_project_image($f, $e); }
    elseif (empty($row['image_url'])) $e['image'] = 'Please choose a project image.';
    if ($e) respond(false, 'Please fix the highlighted fields.', [], $e, 422);

    $sql = 'UPDATE projects SET name=?, category=?, short_description=?, description=?, technologies=?, live_url=?, github_url=?' . ($img ? ', image_url=?' : '') . ' WHERE id=?';
    $args = [$c['name'], $c['category'], $c['short_description'], $c['description'], $c['technologies'], $c['live_url'] ?: null, $c['github_url'] ?: null];
    if ($img) $args[] = $img;
    $args[] = $id;
    db()->prepare($sql)->execute($args);
    if ($img) delete_upload($row['image_url'], 'projects');            // remove the replaced file
    respond(true, 'Project updated.', ['id' => $id, 'image_url' => $img ?? $row['image_url']]);
} catch (Throwable $ex) { error_log('update.php: ' . $ex->getMessage()); respond(false, 'Could not update the project.', [], [], 500); }
