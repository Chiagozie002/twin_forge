<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* GET ajax/projects/list.php?cat=&page=1&per_page=6   (public: active projects only)
   Out: {success, data:{items[], page, per_page, total, total_pages, categories[]}} */
require_method('GET');

$cat     = trim((string)($_GET['cat'] ?? ''));
$page    = max(1, (int)($_GET['page'] ?? 1));
$perPage = min(24, max(1, (int)($_GET['per_page'] ?? 6)));   // bounds stop abusive requests
$offset  = ($page - 1) * $perPage;
// Admin scope: requires a session; can list trashed projects and search by name/category.
$admin  = ($_GET['scope'] ?? '') === 'admin';
if ($admin) require_login();
$status = ($admin && ($_GET['status'] ?? '') === 'trashed') ? 'trashed' : 'active';
$q      = $admin ? trim((string)($_GET['q'] ?? '')) : '';

try {
    $where = 'status = ?'; $params = [$status];
    if ($q !== '') { $like = '%' . addcslashes($q, '%_\\') . '%'; $where .= ' AND (name LIKE ? OR category LIKE ?)'; array_push($params, $like, $like); }
    if ($cat !== '') { $where .= ' AND category = ?'; $params[] = $cat; }

    $st = db()->prepare("SELECT COUNT(*) FROM projects WHERE $where");
    $st->execute($params);
    $total = (int)$st->fetchColumn();

    $st = db()->prepare("SELECT id, name, category, short_description, description, technologies, image_url, live_url, github_url, status
                         FROM projects WHERE $where ORDER BY updated_at DESC LIMIT $perPage OFFSET $offset");   // ints are cast above, safe to inline
    $st->execute($params);
    $items = array_map(function (array $r): array {
        $r['id'] = (int)$r['id'];
        $r['technologies'] = json_decode($r['technologies'] ?? '[]', true) ?: [];
        return $r;
    }, $st->fetchAll());

    // Categories come from the data, so a new category appears in the public filter automatically.
    $cats = db()->query("SELECT DISTINCT category FROM projects WHERE status = 'active' ORDER BY category")->fetchAll(PDO::FETCH_COLUMN);

    respond(true, 'OK', ['items' => $items, 'page' => $page, 'per_page' => $perPage, 'total' => $total,
                         'total_pages' => max(1, (int)ceil($total / $perPage)), 'categories' => $cats]);
} catch (Throwable $e) {
    error_log('list.php: ' . $e->getMessage());
    respond(false, 'Could not load projects right now.', [], [], 500);
}
