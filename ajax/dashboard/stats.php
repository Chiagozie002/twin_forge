<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* GET ajax/dashboard/stats.php [login] -> counts + 5 recent projects + 5 recent messages. */
require_method('GET'); require_login();
try {
    $n = fn(string $sql): int => (int)db()->query($sql)->fetchColumn();
    respond(true, 'OK', [
        'active' => $n("SELECT COUNT(*) FROM projects WHERE status='active'"),
        'trashed' => $n("SELECT COUNT(*) FROM projects WHERE status='trashed'"),
        'messages' => $n('SELECT COUNT(*) FROM messages'),
        'recent_projects' => db()->query("SELECT id, name, category, image_url, status FROM projects WHERE status='active' ORDER BY updated_at DESC LIMIT 5")->fetchAll(),
        'recent_messages' => db()->query('SELECT id, name, email, subject, created_at FROM messages ORDER BY created_at DESC LIMIT 5')->fetchAll(),
    ]);
} catch (Throwable $ex) { error_log('stats.php: ' . $ex->getMessage()); respond(false, 'Could not load dashboard data.', [], [], 500); }
