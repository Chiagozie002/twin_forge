#!/bin/sh
# Real-browser checks (overflow on 14 pages x 6 widths, scrolling, navbar behaviour).
# One-time setup in this folder:  npm i puppeteer-core @sparticuz/chromium bootstrap@5.3.3 @fortawesome/fontawesome-free
# Run:  sh run.sh audit.js     or     sh run.sh behave.js
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
python3 -m http.server 8123 --directory "$ROOT" >/dev/null 2>&1 &
SRV=$!; sleep 1
node "$@"; kill $SRV 2>/dev/null
