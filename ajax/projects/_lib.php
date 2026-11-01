<?php
declare(strict_types=1);
/* Shared validation + upload helpers for project endpoints (underscore = not an endpoint). */

/* Returns [cleanFields, errors]. Technologies arrive as a JSON string (FormData) and are stored as a JSON array. */
function project_input(array $in): array {
    $t = fn(string $k): string => trim((string)($in[$k] ?? ''));
    $c = ['name' => $t('name'), 'category' => $t('category'), 'short_description' => $t('short_description'),
          'description' => $t('description'), 'live_url' => $t('live_url'), 'github_url' => $t('github_url')];
    $e = [];
    if (mb_strlen($c['name']) < 2 || mb_strlen($c['name']) > 120) $e['name'] = 'Name must be 2-120 characters.';
    if ($c['category'] === '' || mb_strlen($c['category']) > 60)  $e['category'] = 'Category is required (max 60 characters).';
    if (mb_strlen($c['short_description']) < 10 || mb_strlen($c['short_description']) > 240) $e['short_description'] = 'Short description must be 10-240 characters.';
    if (mb_strlen($c['description']) < 20 || mb_strlen($c['description']) > 4000) $e['description'] = 'Full description must be 20-4000 characters.';
    foreach (['live_url', 'github_url'] as $k)
        if ($c[$k] !== '' && (!filter_var($c[$k], FILTER_VALIDATE_URL) || !preg_match('~^https?://~i', $c[$k]))) $e[$k] = 'Enter a valid http(s) URL.';
    $tech = json_decode((string)($in['technologies'] ?? '[]'), true);
    $tech = is_array($tech) ? array_values(array_unique(array_filter(array_map(fn($x) => mb_substr(trim((string)$x), 0, 30), $tech)))) : [];
    if (!$tech || count($tech) > 15) $e['technologies'] = 'Add between 1 and 15 technologies.';
    $c['technologies'] = json_encode($tech, JSON_UNESCAPED_UNICODE);
    return [$c, $e];
}

/* Stores an uploaded image and returns its web path, or null (the reason goes in $e['image']).
   There is NO size limit here (the server's own PHP limits still apply, see ajax/.user.ini).
   It still checks the file's REAL content, because accepting any file would let someone upload a PHP script. SVG is refused on purpose (it can carry scripts). */
function save_project_image(array $f, array &$e, string $sub = 'projects'): ?string {
    if (!in_array($sub, ['projects', 'profiles'], true)) $sub = 'projects';                      // whitelist: never trust a path from outside
    $code = $f['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($code === UPLOAD_ERR_NO_FILE) { $e['image'] = 'Please choose an image.'; return null; }
    if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) { $e['image'] = 'This image is larger than the server allows. Ask your host to raise upload_max_filesize and post_max_size.'; return null; }
    if ($code !== UPLOAD_ERR_OK) { $e['image'] = 'Image upload failed. Please try again.'; return null; }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'][$mime] ?? null;
    if (!$ext || !@getimagesize($f['tmp_name'])) { $e['image'] = 'Please choose a real image file (JPG, PNG, WebP or GIF).'; return null; }
    $dir = __DIR__ . '/../../uploads/' . $sub;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) { $e['image'] = 'Upload folder is not writable.'; return null; }
    $name = bin2hex(random_bytes(16)) . '.' . $ext;                                              // random name: no overwrite, no path tricks
    if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) { $e['image'] = 'Could not store the image.'; return null; }
    return "uploads/$sub/$name";
}

/* Deletes a previously uploaded file, but only if it really sits inside uploads/<sub>. Safe to call with null. */
function delete_upload(?string $rel, string $sub): void {
    if (!$rel) return;
    $dir = realpath(__DIR__ . '/../../uploads/' . $sub); $file = realpath(__DIR__ . '/../../' . $rel);
    if ($dir && $file && str_starts_with($file, $dir . DIRECTORY_SEPARATOR) && is_file($file)) @unlink($file);
}

/* PHP silently empties $_POST and $_FILES when a request is bigger than post_max_size. Compare the real request size against the real limit
   (a small empty form must NOT count as oversized) and answer clearly. */
function reject_oversized_post(): void {
    $raw = trim((string)ini_get('post_max_size')); $n = (int)$raw;
    $max = match (strtolower(substr($raw, -1))) { 'g' => $n * 1073741824, 'm' => $n * 1048576, 'k' => $n * 1024, default => $n };
    if ($max > 0 && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $max)
        respond(false, 'The upload is larger than the server allows. Ask your host to raise post_max_size and upload_max_filesize.', [], ['image' => 'This image is larger than the server allows.'], 413);
}
