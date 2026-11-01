<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/../projects/_lib.php';
/* POST (multipart) ajax/profile/upload-picture.php {image} [login + CSRF]. No size limit; the file must be a real image (checked by content). Stored in uploads/profiles. */
require_method('POST'); $uid = require_login(); csrf_check(); reject_oversized_post();
$e = [];
if (empty($_FILES['image'])) respond(false, 'Choose an image first.', [], ['image' => 'Choose an image first.'], 422);
$path = save_project_image($_FILES['image'], $e, 'profiles');
if (!$path) respond(false, $e['image'] ?? 'Upload failed.', [], $e, 422);
try {
    $st = db()->prepare('SELECT picture_url FROM users WHERE id = ?'); $st->execute([$uid]); $old = (string)$st->fetchColumn();
    db()->prepare('UPDATE users SET picture_url = ? WHERE id = ?')->execute([$path, $uid]);
    delete_upload($old, 'profiles');                                  // remove the replaced file
    respond(true, 'Profile picture updated.', ['picture_url' => $path]);
} catch (Throwable $ex) { error_log('upload-picture: ' . $ex->getMessage()); respond(false, 'Could not save the picture.', [], [], 500); }
