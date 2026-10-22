const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
let fixture;
function loadFixture() {
    if (fixture) return fixture;
    const root = path.resolve(__dirname, '../fixtures/google-fonts');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    const entries = new Map();
    for (const resource of [manifest.css, ...manifest.assets]) {
        const file = path.resolve(root, resource.file);
        assert.ok(file.startsWith(root + path.sep), 'fixture stays in its directory');
        const body = fs.readFileSync(file);
        assert.equal(body.length, resource.bytes, 'font fixture byte count: ' + resource.file);
        assert.equal(crypto.createHash('sha256').update(body).digest('hex'), resource.sha256, 'font fixture identity: ' + resource.file);
        if (resource === manifest.css) assert.match(body.toString('utf8'), /@font-face/);
        else assert.equal(body.subarray(0, 4).toString(), 'wOF2', 'real WOFF2 signature');
        entries.set(new URL(resource.url).href, { body, contentType: resource === manifest.css ? 'text/css; charset=utf-8' : 'font/woff2' });
    }
    fixture = { manifest, entries };
    return fixture;
}
// Only test contexts call this helper. Live deployment QA explicitly opts out;
// the application and its Google Fonts CSS remain unchanged.
module.exports = function createFontResponseCache(errors) {
    const live = process.env.BATH_TEST_LIVE_FONTS === '1';
    const data = live ? null : loadFixture();
    return async route => {
        const url = new URL(route.request().url());
        if (!['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname) || live) return false;
        try {
            const resource = data.entries.get(url.href);
            assert.ok(resource, 'Unrecorded Google font resource: ' + url.origin + url.pathname);
            await route.fulfill({ status: 200, contentType: resource.contentType, headers: { 'access-control-allow-origin': '*', 'cache-control': 'public,max-age=31536000,immutable' }, body: resource.body });
        } catch (error) {
            errors.push('Font fixture failed: ' + error.message);
            await route.abort();
        }
        return true;
    };
};
module.exports.verify = loadFixture;

module.exports.install = async function install(context, errors) {
    if (process.env.BATH_TEST_LIVE_FONTS === '1') return;
    const serve = module.exports(errors);
    await context.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, async route => {
        if (!await serve(route)) await route.continue();
    });
};
