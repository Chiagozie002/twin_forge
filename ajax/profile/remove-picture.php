<?php
declare(strict_types=1);
require __DIR__ . '/../config.php'; require __DIR__ . '/../projects/_lib.php';
/* POST ajax/profile/remove-picture.php [login + CSRF]: clears the founder's profile picture (the site then shows their initial / a silhouette). Safe to call twice. */
require_method('POST'); $uid = require_login(); csrf_check();
try {
    $st = db()->prepare('SELECT picture_url FROM users WHERE id = ?'); $st->execute([$uid]); $old = $st->fetchColumn() ?: null;
    db()->prepare('UPDATE users SET picture_url = NULL WHERE id = ?')->execute([$uid]);
    delete_upload($old, 'profiles');
    respond(true, 'Profile picture removed.', ['picture_url' => null]);
} catch (Throwable $ex) { error_log('remove-picture: ' . $ex->getMessage()); respond(false, 'Could not remove the picture.', [], [], 500); }
