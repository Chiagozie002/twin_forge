# Connect Twin Forge to your database

**How it works.** The pages are plain HTML. JavaScript calls small PHP files in `ajax/` (they answer with JSON), and those PHP files talk to MySQL through PDO.
Only **one file** knows your database: `ajax/config.php`. One switch decides whether the site uses sample data or the database: `assets/js/api.js` (`DEMO_MODE`).

## 1. Requirements
PHP 8.1+ with `pdo_mysql`, `mbstring` and `fileinfo`; MySQL 5.7+ or MariaDB 10.3+; Apache or Nginx (or `php -S` while developing).

## 2. Create the database and a limited user
```sql
CREATE DATABASE twin_forge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tf_user'@'localhost' IDENTIFIED BY 'a-long-random-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON twin_forge.* TO 'tf_user'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Create the tables
```bash
mysql -u root -p twin_forge < database/schema.sql
```
This creates `messages`, `projects`, `users`, `settings`, `password_resets` and `rate_limits`.

## 4. Put your settings in `ajax/config.php`
Open `ajax/config.php`. Everything you need to change is at the top:
```php
// Database
const DB_DSN  = 'mysql:host=localhost;dbname=twin_forge;charset=utf8mb4';
const DB_USER = 'tf_user';
const DB_PASS = 'a-long-random-password';

// EMAIL SETTINGS (the contact form saves to the database AND emails you)
const MAIL_TRANSPORT = 'smtp';                    // 'mail' = PHP mail() (often goes to spam), 'smtp' = a real mailbox (recommended)
const MAIL_TO        = 'you@yourdomain.com';      // where contact messages arrive (several addresses: separate with commas)
const MAIL_FROM      = 'no-reply@yourdomain.com'; // use an address on your domain / the SMTP account
const MAIL_FROM_NAME = 'Twin Forge Website';
const SMTP_HOST   = 'smtp.yourprovider.com';
const SMTP_PORT   = 587;        // 587 + 'tls'   or   465 + 'ssl'
const SMTP_SECURE = 'tls';
const SMTP_USER   = 'you@yourdomain.com';
const SMTP_PASS   = 'your-mailbox-password';
```
**Where is the email code?** Settings: `ajax/config.php` (EMAIL SETTINGS block). Sending code: `ajax/mailer.php` (you normally never edit it). The endpoint that receives the form: `ajax/messages/submit.php`.

Typical SMTP values (check your provider's page for the exact host):
| Provider | SMTP_HOST | Port / SMTP_SECURE | SMTP_USER / SMTP_PASS |
|---|---|---|---|
| Gmail | `smtp.gmail.com` | 587 / `tls` | your Gmail address / an **App password** (Google Account > Security > 2-Step Verification > App passwords; your normal password will not work) |
| Zoho Mail | `smtp.zoho.com` | 587 / `tls` | your Zoho address / its password |
| Your hosting email (cPanel etc.) | `mail.yourdomain.com` | 465 / `ssl` | the full email address / its password |

For Gmail, set `MAIL_FROM` to that same Gmail address (Gmail rewrites other senders). Keep `SMTP_VERIFY_TLS = true`.
**The message is always saved to the database first.** If the email fails (wrong password, host down), the visitor still sees success, nothing is lost, and the reason is written to the PHP error log (look for `mailer:` or `notification email could not be sent`).

*Already imported an older `schema.sql`?* Run these once: `ALTER TABLE messages ADD ip_hash CHAR(64) NULL, ADD INDEX (ip_hash, created_at);` and the two `CREATE TABLE` statements for `password_resets` and `rate_limits` at the bottom of `database/schema.sql`.

## 5. Create the two founder accounts (there is no sign-up page)
```bash
php -r "echo password_hash('YourStrongPassword', PASSWORD_DEFAULT);"
```
```sql
INSERT INTO users (name, email, password_hash, role_title) VALUES
 ('First Founder',  'first@yourdomain.com',  '<paste hash 1>', 'Co-Founder'),
 ('Second Founder', 'second@yourdomain.com', '<paste hash 2>', 'Co-Founder');
```
The homepage shows the **first two users (by id)** as the co-founders: `bio_1` belongs to the first, `bio_2` to the second.

## 6. Make the upload folders writable
`uploads/projects/` and `uploads/profiles/` must be writable by the web-server user (for example `chown -R www-data uploads && chmod -R 775 uploads`).
`uploads/.htaccess` stops PHP running there on Apache. On **Nginx** add:
```nginx
location ^~ /uploads/ { location ~ \.php$ { return 403; } }
```

## 7. Turn demo mode off
In `assets/js/api.js` set `DEMO_MODE: false`. Then:
- the homepage loads projects from `ajax/projects/list.php`, and About / Mission / Vision / founders / social links from `ajax/settings/get.php`;
- the admin pages require a login (they call `ajax/profile/get.php` first and send you to `cpanel/login.html` if there is no session);
- every admin action saves to MySQL.

## 8. Open it through a web server (not by double-clicking the files)
Sessions and AJAX need `http://`. From the project folder: `php -S localhost:8000`, then open `http://localhost:8000`. (Or put the folder in XAMPP/Laragon `htdocs`.)

**Quick check:** open `http://localhost:8000/ajax/projects/list.php` directly. You should see `{"success":true,...}`.

## 9. Test it end to end
| Do this | You should see |
|---|---|
| Send the contact form | a row in `messages`, it shows in Admin > Messages, **and an email arrives at `MAIL_TO`** (check the spam folder the first time) |
| Sign in at `/cpanel/login.html` | the dashboard |
| Add a project with a picture | it appears on the homepage |
| Edit it, then delete it | it moves to Trash; Restore brings it back |
| Save Website Settings | the homepage text changes |
| Add / remove your profile picture | the header avatar and the founder card update |
| Login page > *Forgot password?* > enter a founder email | a 6-digit code arrives by email (valid 10 minutes, one use, 5 tries); the code page leads to *new password*; you receive a "password was changed" email; the new password signs in |

## 10. What talks to what
| Feature | Endpoint | Table |
|---|---|---|
| Contact form | `ajax/messages/submit.php` | `messages` |
| Public projects | `ajax/projects/list.php` | `projects` |
| Add / edit / trash / restore / delete project | `ajax/projects/*.php` | `projects` + `uploads/projects/` |
| Messages inbox | `ajax/messages/*.php` | `messages` |
| About, mission, vision, bios, social links | `ajax/settings/*.php` | `settings` (key / value) |
| Profile, picture, password | `ajax/profile/*.php` | `users` + `uploads/profiles/` |
| Login / logout | `ajax/auth/login.php`, `logout.php` | `users` (+ PHP session) |
| Password recovery (email, code, new password) | `ajax/auth/forgot-password.php`, `verify-otp.php`, `reset-password.php` | `password_resets`, `rate_limits` (+ `users`) |

Every endpoint answers `{ "success": true|false, "message": "...", "data": {...}, "errors": {...} }`.

## 11. Before going live
- Serve over **HTTPS** (the session cookie becomes `secure` automatically).
- Keep credentials out of the web root (load them from environment variables or a file above it).
- Do not upload `tests/`, `database/` or `README.md` to the live server.
- Use `MAIL_TRANSPORT = 'smtp'` so contact emails are delivered reliably (see step 4). The message is saved even if mail fails.
- The contact form already limits each IP address (`CONTACT_MAX_PER_HOUR`); login still limits per session only, so add per-IP limiting there.
- Make sure `MAIL_TRANSPORT = 'smtp'` works, because password recovery depends on email (send yourself a test code). Take backups.

## 12. If something goes wrong
PHP errors are **hidden from visitors on purpose and written to the PHP error log**; look there first.
- *"Server returned an invalid response"*: PHP is not running, or the path is wrong. Open the endpoint URL directly.
- *"Could not load projects"* or any 500: wrong DB credentials or missing tables.
- *Sent back to the login page again and again*: the session cookie is not being kept. Use `http://localhost`, not `file://`, and the same host name every time.
- *"Security check failed" (419)*: the session expired. Reload the admin page.
- *Image upload fails*: folder permissions, or PHP's `upload_max_filesize` / `post_max_size` (see `ajax/.user.ini`).
- *Contact form says "received" but no email arrives*: check the spam folder, then the PHP error log for a `mailer:` line (wrong SMTP host/port/password, or a blocked port). If you use `MAIL_TRANSPORT = 'mail'`, your server may have no mail system at all: switch to `'smtp'`.
- Note: the backend tests ran against SQLite, not MySQL. The few MySQL-specific parts are `NOW()`, `ON DUPLICATE KEY UPDATE` (`ajax/settings/_lib.php`), the `JSON` column and `ENUM`.

## How password recovery protects you
- The code is 6 digits, stored only as a **hash**, valid **10 minutes**, usable **once**, and dies after **5 wrong tries**. A new request cancels the old code.
- The reset token (returned after the code is verified) is also stored only as a hash, valid **15 minutes**, usable once.
- The page says the same thing whether or not an email has an account, and answers equally fast (the email is sent after the reply), so nobody can discover which emails are founders.
- Limits (per hour): 5 code requests per email, 10 per IP; 10 code checks per email, 30 per IP; 20 resets per IP.
- There is no "login session" table, so an already signed-in session is not cut off when a password is reset; the owner is told by email.
