<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* GET ajax/settings/get.php (PUBLIC: the homepage and the admin page both use it)
   -> {data:{settings:{about,mission,vision,bio_1,bio_2,social_*}, founders:[{name,role_title,picture_url} x2]}}
   Only public-facing fields are returned: never emails or hashes. */
require_method('GET');
try {
    respond(true, 'OK', [
        'settings' => db()->query('SELECT k, v FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR),
        'founders' => db()->query('SELECT name, role_title, picture_url FROM users ORDER BY id LIMIT 2')->fetchAll(),
    ]);
} catch (Throwable $ex) { error_log('settings/get.php: ' . $ex->getMessage()); respond(false, 'Could not load settings.', [], [], 500); }
