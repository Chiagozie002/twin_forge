# Twin Forge - Phases 1-9
Open `index.html` (use any static server, e.g. `php -S localhost:8000`). Demo mode is ON: projects come from `assets/js/demo-data.js`.
**Go live:** import `database/schema.sql`, edit credentials in `ajax/config.php`, set `TF.DEMO_MODE = false` in `assets/js/api.js`.
**Map:** set `MAP_EMBED_URL` in `assets/js/contact.js`.
Contracts: every endpoint returns `{success, message, data, errors}`. `projects/list.php` takes `cat, page, per_page` and returns `items, page, per_page, total, total_pages, categories`.
**Done:** public site (live content from settings), contact, 404, custom themed scrollbar; auth in `cpanel/` (login) with endpoints in `ajax/auth/`; admin: dashboard, projects, add-project, trash, messages, My Profile (picture / details / password), Website Settings (4 independent sections) and every endpoint they need.
**Public site polish done:** preloader, glass toasts, active nav on scroll/click, product CTA with changing background, redesigned contact page (map, reach-us + social icons, form).
**Every page is now built**, including the 3-step password recovery in `cpanel/` (forgot-password -> verify-otp -> reset-password).
**Backend still to write by you:** the 3 recovery endpoints in `ajax/auth/` (501 stubs with a TODO list inside each). Until then the pages show an honest "not available yet" message in live mode; in demo mode they simulate the flow with the code `123456`.
**Replace later:** project links (`demo-data.js`, "#"), contact details + map URLs (`contact.html`, `assets/js/contact.js`).
**Founder photos:** drop `founder-1.jpg` and `founder-2.jpg` (4:5 portraits) into `assets/images/founders/`; until then initials show.
**Uploads:** `uploads/projects/` must be writable by PHP; its `.htaccess` blocks script execution.
**Note:** login redirects to `cpanel/index.html`, which now exists. Admin pages call `ajax/profile/get.php` first; with no session they redirect to the login page.

## Backend status and checks
All endpoints in `ajax/` are real PHP (PDO + prepared statements, session auth, CSRF, server-side validation) **except** the three password-recovery endpoints in `ajax/auth/`, which are 501 stubs with a TODO list inside each file.
`python3 tests/backend_test.py` runs 90+ end-to-end checks (auth, CSRF, validation, uploads, soft delete/restore, messages, settings, profile, SQL-injection and header-injection attempts). It needs `php` on your PATH and uses a throw-away SQLite copy of the project, so it never touches your MySQL data.
Before going live, follow the **DEPLOY TODO** list at the top of `ajax/config.php`.

`tests/recovery_flow_test.js` runs the three recovery pages in a simulated browser (needs `npm i jsdom`, then `node tests/recovery_flow_test.js`).

## Pictures
There is **no app-level image size limit**. Project pictures are required (a project cannot be added, or edited, to have no picture); profile pictures are optional (add, change, remove). The server still checks that the file is a real image (JPG, PNG, WebP or GIF; SVG is refused because it can carry scripts). Only PHP's own limits apply: `upload_max_filesize` / `post_max_size` (see `ajax/.user.ini`, set to 64M / 70M).
`tests/admin_pages_test.js` exercises project edit/delete/search, add-project and the profile picture flow in a simulated browser (`npm i jsdom`, then `node tests/admin_pages_test.js`).
