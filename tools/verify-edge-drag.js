// Edge-drag gate for the side menu. Asserts the right-edge swipe opens and
// closes the menu with real TOUCH input, not mouse.
//
// This bug shipped because the gesture was only ever exercised by hand, and
// by mouse at that. Two independent defects made touch fail while mouse
// worked, and each one alone is enough to break it:
//   1. `touch-action: pan-x pan-y` on html/body let the browser claim the
//      horizontal drag and fire pointercancel, so the app's handler never ran.
//   2. The grab zone was 48 * uiScale, which collapses to ~15px on a phone,
//      under the 24px tap floor verify-layout already enforces.
//
// Usage: node tools/verify-edge-drag.js
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appUrl = 'http://localhost:4185/';
const port = Number(process.env.CDP_PORT || 9341);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-edge-' + Date.now());

// Landscape on purpose: a portrait phone viewport raises .portrait-lock, a
// full-screen overlay that sits over the edge strip. The menu's handlers are
// document-level so the result is the same, but testing the orientation the
// app actually runs in avoids depending on that.
const VIEWPORTS = [
    { name: 'phone-landscape', w: 844, h: 390 },
    { name: 'tablet-landscape', w: 1180, h: 820 },
    // Short enough that a settings screen genuinely overflows, so the
    // vertical-scroll guard has something real to test. Also the most
    // discriminating viewport for the grab-zone floor: unscaled it would be
    // 48 * (320/800) = 19.2px, so removing the floor fails here by 4.8px
    // rather than by a fraction of a pixel.
    { name: 'phone-short', w: 844, h: 320 }
];
const TAP_FLOOR = 24;

const failures = [];
const errors = [];
let scrollChecked = false;
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function fail(m) { failures.push(m); console.log('FAIL - ' + m); }
function pass(m) { console.log('PASS - ' + m); }

async function main() {
    const server = spawn(process.execPath, [path.join(root, 'tools', 'serve.js'), '4185'], { stdio: 'ignore' });
    const chrome = spawn(chromePath, [
        '--headless=new', '--disable-gpu', '--no-sandbox',
        '--remote-debugging-port=' + port,
        '--user-data-dir=' + profileDir,
        'about:blank'
    ], { stdio: 'ignore' });

    let ws;
    try {
        await delay(900);
        let page = null;
        const started = Date.now();
        while (Date.now() - started < 20000 && !page) {
            try {
                const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
                page = list.find(t => t.type === 'page');
            } catch (e) {}
            if (!page) await delay(200);
        }
        if (!page) throw new Error('Chrome DevTools target did not appear');

        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
            ws.addEventListener('open', res, { once: true });
            ws.addEventListener('error', rej, { once: true });
        });
        let nextId = 1;
        const pending = new Map();
        ws.addEventListener('message', ev => {
            const m = JSON.parse(String(ev.data));
            if (m.method === 'Runtime.exceptionThrown') {
                errors.push('exception: ' + (m.params.exceptionDetails.exception
                    && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
            }
            if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
                errors.push('console.error: ' + m.params.entry.text);
            }
            if (!m.id || !pending.has(m.id)) return;
            const h = pending.get(m.id);
            pending.delete(m.id);
            if (m.error) h.reject(new Error(m.error.message)); else h.resolve(m.result);
        });
        const send = (method, params) => new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
        });
        const evaluate = async (expression) => {
            const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
            return r.result.value;
        };

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: VIEWPORTS[0].w, height: VIEWPORTS[0].h, deviceScaleFactor: 1, mobile: false });
        await send('Page.navigate', { url: appUrl });
        await delay(2400);
        // Same reason verify-layout does this: a freshly generated sw.js only
        // activates after a load, so measuring without this reads stale assets.
        await evaluate("(async () => { const rs = await navigator.serviceWorker.getRegistrations(); for (const r of rs) { await r.unregister(); } const ks = await caches.keys(); for (const k of ks) { await caches.delete(k); } return 1; })()");
        await send('Page.reload');
        await delay(2400);

        // Wait for boot to actually finish rather than sleeping a fixed time:
        // .boot-loader sits above everything, and measuring through it produced
        // a false failure that looked like an app bug.
        async function waitForBoot() {
            for (let i = 0; i < 60; i++) {
                const ok = await evaluate(`(() => {
                    const l = document.getElementById('bootLoader');
                    const hidden = !l || l.classList.contains('hidden') || l.getClientRects().length === 0;
                    return hidden && document.readyState === 'complete' && !!window.CognitiveMenu && !!window.CognitiveRouter;
                })()`).catch(() => false);
                if (ok) return true;
                await delay(250);
            }
            throw new Error('app did not finish booting');
        }
        await waitForBoot();

        async function reset() {
            await evaluate("window.CognitiveMenu.close(), 1");
            await delay(450);
        }
        async function drag(kind, points) {
            const first = points[0];
            if (kind === 'touch') {
                await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: first.x, y: first.y }] });
            } else {
                await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: first.x, y: first.y, button: 'left', clickCount: 1, buttons: 1 });
            }
            for (let i = 1; i < points.length; i++) {
                const p = points[i];
                if (kind === 'touch') {
                    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] });
                } else {
                    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 });
                }
                await delay(16);
            }
            const last = points[points.length - 1];
            if (kind === 'touch') await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            else await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, x: last.x, y: last.y });
            await delay(500);
            return evaluate("window.CognitiveMenu.isOpen()");
        }
        function edgePath(startX, y, distance, steps) {
            const pts = [];
            for (let i = 0; i <= steps; i++) pts.push({ x: Math.round(startX - distance * (i / steps)), y });
            return pts;
        }
        // The drawer lives on the right, so opening drags left (-dx) and closing
        // drags right (+dx): finishMenuDrag reads progress as clamp(dx/width) in
        // close mode and clamp(-dx/width) in open mode.
        function closePath(startX, y, distance, steps) {
            const pts = [];
            for (let i = 0; i <= steps; i++) pts.push({ x: Math.round(startX + distance * (i / steps)), y });
            return pts;
        }

        // 6. pan-y must still permit vertical scrolling where the app needs it,
        //    or this fix traded one broken gesture for another. Only viewports
        //    where a settings screen genuinely overflows can test this, so the
        //    caller routes to one and the gate fails if none ever does.
        async function runScrollCheck(vp) {
            for (const id of ['shoppingSettings', 'gngSettings', 'realitySettings', 'pairsSettings', 'dualNbackSettings']) {
                await evaluate("window.CognitiveRouter.navigate(" + JSON.stringify(id) + "), 1").catch(() => null);
                await delay(650);
                const found = await evaluate(`(() => {
                    const s = document.getElementById(${JSON.stringify(id)});
                    if (!s || s.classList.contains('hidden') || s.getClientRects().length === 0) return null;
                    const o = s.querySelector('.settings-options');
                    if (!o || o.scrollHeight <= o.clientHeight + 4) return null;
                    const r = o.getBoundingClientRect();
                    return {
                        id: s.id,
                        x: Math.round(r.x + r.width / 2),
                        top: Math.round(r.y + 12),
                        bottom: Math.round(r.bottom - 12),
                        before: o.scrollTop,
                        max: o.scrollHeight - o.clientHeight
                    };
                })()`);
                if (!found) continue;

                // Drag upward (finger moves up => content scrolls down).
                const travel = Math.min(found.bottom - found.top, Math.max(60, Math.round(found.max * 0.8)));
                const pts = [];
                for (let i = 0; i <= 10; i++) pts.push({ x: found.x, y: Math.round(found.bottom - travel * (i / 10)) });
                await drag('touch', pts);
                const after = await evaluate(`document.getElementById(${JSON.stringify(found.id)}).querySelector('.settings-options').scrollTop`);
                scrollChecked = true;
                if (after > found.before) {
                    pass('vertical touch scroll still works on ' + found.id + ' (' + found.before + ' -> ' + after + ' of ' + found.max + ')');
                } else {
                    fail('vertical touch scroll is broken on ' + found.id + ' (scrollTop stayed at ' + after + ', max ' + found.max + ')');
                }
                await evaluate("window.CognitiveRouter.goHome(), 1").catch(() => null);
                await delay(400);
                return;
            }
            console.log('NOTE - no settings screen overflows at ' + vp.name + ' (nothing to scroll)');
        }

        for (const vp of VIEWPORTS) {
            await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false });
            await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
            await send('Page.navigate', { url: appUrl });
            await waitForBoot();
            await evaluate("window.CognitiveRouter.goHome(), 1").catch(() => null);
            await delay(600);

            console.log('\n== ' + vp.name + ' ' + vp.w + 'x' + vp.h + ' ==');
            // 25% down is clear of the home screen's game buttons. The app
            // deliberately refuses edge drags that start on an interactive
            // target (isInteractiveMenuTarget), so testing the grab zone over a
            // .category-btn would measure the wrong thing.
            const y = Math.round(vp.h * 0.25);

            // 1. The reported bug: touch drag from the very edge opens the menu.
            await reset();
            let opened = await drag('touch', edgePath(vp.w - 4, y, Math.round(vp.w * 0.45), 12));
            opened
                ? pass('touch drag from the right edge opens the menu')
                : fail('touch drag from the right edge did NOT open the menu');

            // 2. The gesture must also close it, from inside the open menu.
            if (opened) {
                const menu = await evaluate("(() => { const r = document.getElementById('slideMenu').getBoundingClientRect(); return { x: r.x, w: r.width }; })()");
                const startX = Math.round(menu.x + menu.w / 2);
                const closed = await drag('touch', closePath(startX, y, Math.round(menu.w * 0.8), 12));
                !closed
                    ? pass('touch drag inside the open menu closes it')
                    : fail('touch drag inside the open menu did NOT close it');
            }

            // 3. The grab zone must reach the 24px floor the layout gate uses.
            //    Tested AT 24px, not 23px: the predicate is inclusive
            //    (clientX >= width - zone), so 24px is the exact boundary and
            //    this is the value that actually discriminates.
            await reset();
            const grabInset = TAP_FLOOR;
            const atFloor = await drag('touch', edgePath(vp.w - grabInset, y, Math.round(vp.w * 0.45), 12));
            atFloor
                ? pass('touch drag ' + grabInset + 'px inside the edge opens the menu (zone floor)')
                : fail('touch drag ' + grabInset + 'px inside the edge did NOT open the menu; grab zone is narrower than the ' + TAP_FLOOR + 'px floor');

            // 4. ...and must not reach further in than the floor, or it would
            //    hijack ordinary taps near the right edge.
            await reset();
            const tooDeep = await drag('touch', edgePath(vp.w - TAP_FLOOR - 60, y, Math.round(vp.w * 0.45), 12));
            !tooDeep
                ? pass('drag starting well inside the screen does NOT open the menu')
                : fail('drag starting ' + (TAP_FLOOR + 60) + 'px inside the edge wrongly opened the menu');

            // 5. Mouse is the path that always worked; guard against regressing it.
            await reset();
            const mouseOpened = await drag('mouse', edgePath(vp.w - 4, y, Math.round(vp.w * 0.45), 12));
            mouseOpened
                ? pass('mouse drag from the right edge opens the menu')
                : fail('mouse drag from the right edge did NOT open the menu');

            await runScrollCheck(vp);
            await evaluate("window.CognitiveRouter.goHome(), 1").catch(() => null);
            await delay(400);
        }

        if (!scrollChecked) {
            fail('the vertical-scroll guard never ran at any viewport');
        }

        console.log('');
        if (errors.length) {
            console.log('page errors:');
            errors.forEach(e => console.log('  ' + e));
        }
        if (errors.length) failures.push('page errors: ' + errors.length);
    } finally {
        try { if (ws) ws.close(); } catch (e) {}
        try { server.kill(); } catch (e) {}
        try { chrome.kill(); } catch (e) {}
    }

    if (failures.length) {
        console.log('\n' + failures.length + ' check(s) failed');
        process.exit(1);
    }
    console.log('\nAll edge-drag checks passed');
}

main().catch(e => { console.error('GATE ERROR: ' + e.message); process.exit(1); });
