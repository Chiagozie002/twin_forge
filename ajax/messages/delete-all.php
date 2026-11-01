<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';
/* POST ajax/messages/delete-all.php {confirm:"DELETE"} [login + CSRF]. The extra confirm field stops an accidental or forged empty POST from wiping the table. */
require_method('POST'); require_login(); csrf_check();
if ((input()['confirm'] ?? '') !== 'DELETE') respond(false, 'Confirmation missing.', [], [], 422);
try { $n = db()->exec('DELETE FROM messages'); respond(true, 'All messages deleted.', ['deleted' => (int)$n]); }
catch (Throwable $ex) { error_log('delete-all.php: ' . $ex->getMessage()); respond(false, 'Could not delete the messages.', [], [], 500); }
