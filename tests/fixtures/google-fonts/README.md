# Exact Google Fonts test fixture

These unmodified Google Fonts responses match app/globals.css and the Chrome user agent recorded in manifest.json. Production CSS is unchanged. Tests serve the original CSS (including family, weight, style, display and unicode-range) and exact WOFF2 bodies at their original URLs.

Every response has a recorded source URL, byte count and SHA-256. The helper checks every body before routing; missing/modified resources fail, never fall back to empty data or a different font. The two original OFL licenses are included. No credentials are required.

The fixture is used only by isolated browser tests. Set BATH_TEST_LIVE_FONTS=1 for live deployment QA; this disables fixture interception and uses the browser's real Google Fonts requests. No remote response is synthesized in live mode.

To intentionally update: use the approved Playwright installation via PLAYWRIGHT_MODULE and run node tests/helpers/update-font-fixtures.cjs. Review the app CSS query, acquisition metrics, manifests and font/PNG/PDF output before accepting changed bytes. Do not update snapshots to hide a failed font load.

The scoped .gitattributes preserves exact bytes on Windows and CI, including CSS and license newlines.
