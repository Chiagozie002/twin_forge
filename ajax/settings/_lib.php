<?php
declare(strict_types=1);
/* Shared helpers for settings endpoints (underscore = not an endpoint). */
function setting_set(string $k, string $v): void {
    db()->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)')->execute([$k, $v]);
}
/* Reads $in[$k], enforces length, records an error keyed by field name, returns the trimmed value. */
function setting_text(array $in, string $k, int $min, int $max, string $label, array &$e): string {
    $v = trim((string)($in[$k] ?? '')); $n = mb_strlen($v);
    if ($n < $min || $n > $max) $e[$k] = "$label must be $min-$max characters.";
    return $v;
}
