<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/_lib.php';
/* POST (multipart/form-data) ajax/projects/add.php  [login + CSRF]
   Fields: name, category, short_description, description, live_url, github_url, technologies(JSON array), image(file) */
require_method('POST'); require_login(); csrf_check(); reject_oversized_post();
[$c, $e] = project_input($_POST);
$img = null; $f = $_FILES['image'] ?? null;
$has = $f && ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
if (!$has) $e['image'] = 'Please choose a project image.';      // a project can never be created without a picture
elseif (!$e) $img = save_project_image($f, $e);                 // only store the file when the text fields are valid (no orphan files)
if ($e) respond(false, 'Please fix the highlighted fields.', [], $e, 422);
try {
    $st = db()->prepare("INSERT INTO projects (name, category, short_description, description, technologies, image_url, live_url, github_url, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')");
    $st->execute([$c['name'], $c['category'], $c['short_description'], $c['description'], $c['technologies'], $img, $c['live_url'] ?: null, $c['github_url'] ?: null]);
    respond(true, 'Project added.', ['id' => (int)db()->lastInsertId(), 'image_url' => $img], [], 201);
} catch (Throwable $ex) { error_log('add.php: ' . $ex->getMessage()); respond(false, 'Could not save the project.', [], [], 500); }
