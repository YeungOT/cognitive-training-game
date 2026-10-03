// Whole-layout gate: asserts every screen lays out sanely at every viewport and
// that the composer-built games still agree with each other region by region.
//
// Complements tools/verify-parity.js (bottom control row) and
// tools/verify-games.js (behaviour). This one is about geometry: the vertical
// stack, horizontal overflow, and tap-target floors.
//
// Usage: node tools/verify-layout.js
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appUrl = process.env.APP_URL || 'http://localhost:4183/';
const port = Number(process.env.CDP_PORT || 9352);
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.join(os.tmpdir(), 'cognitive-layout-' + Date.now());

const TOL = 1;
const TAP_FLOOR = 24;
const failures = [];
const knownFailures = [];
const consoleErrors = [];

const VIEWPORTS = [
    { name: 'iphone-se', w: 667, h: 375 },
    { name: 'iphone-13', w: 844, h: 390 },
    { name: 'desktop', w: 1280, h: 800 },
    { name: 'desktop-xl', w: 1920, h: 1080 }
];

// group 'composer' screens are built by the shared Game Screen, so their
// top-bar / stage / footer heights must match each other exactly. realityBoard
// is still on the legacy static-markup path and is measured for its own sanity
// only - it is the remaining migration gap.
const SCREENS = [
    { name: 'palm', group: 'composer', steps: ["CognitiveRouter.navigate('palm')"] },
    { name: 'gng', group: 'composer', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameGngBtn').click()", "document.getElementById('gngStartBtn').click()"] },
    { name: 'nback', group: 'composer', steps: ["CognitiveRouter.navigate('nbackModeSelect')", "document.getElementById('singleNbackBtn').click()"] },
    {
        name: 'dual', group: 'composer',
        steps: [
            "CognitiveRouter.navigate('nbackModeSelect')",
            "document.getElementById('dualNbackBtn').click()",
            "(() => { const a = document.getElementById('dualModality1Select'); a.value = 'position'; a.dispatchEvent(new Event('change')); const b = document.getElementById('dualModality2Select'); b.value = 'image'; b.dispatchEvent(new Event('change')); return 1; })()",
            "document.getElementById('dualStartBtn').click()"
        ]
    },
    { name: 'food', group: 'composer', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameFoodBtn').click()", "document.querySelector('#foodCategorySelect .category-btn').click()"] },
    {
        name: 'shopping', group: 'composer',
        steps: [
            "CognitiveRouter.navigate('mainMenu')",
            "document.getElementById('gameShoppingBtn').click()",
            "document.getElementById('shoppingStartBtn').click()",
            "document.getElementById('shoppingManualStartBtn').click()"
        ]
    },
    { name: 'different', group: 'composer', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameDifferentBtn').click()"] },
    { name: 'pairs', group: 'composer', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gamePairsBtn').click()", "document.getElementById('pairsStartBtn').click()"] },
    { name: 'reality', group: 'legacy', steps: ["CognitiveRouter.navigate('realityBoard')"] }
];

// Acknowledged, pre-existing violations. They do not fail the gate, but any
// NEW violation of the same kind does. Kept explicit so they stay visible
// rather than being quietly tolerated. Keys are "<screenId> <firstClassName>".
const KNOWN_TARGET_FAILURES = [
    'realityBoard reality-dot'
];

const METRIC = "(() => {"
    + " const s=[...document.querySelectorAll('.app-screen')].filter(x=>!x.classList.contains('hidden'))[0];"
    + " if(!s) return null;"
    + " const box=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10,y:Math.round(r.y*10)/10,b:Math.round(r.bottom*10)/10,x:Math.round(r.x*10)/10}; };"
    + " const kids=[...s.children];"
    + " const small=[];"
    + " s.querySelectorAll('button, select, [role=button], a[href]').forEach(el=>{"
    + "   const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);"
    + "   if(r.width<1||r.height<1||cs.display==='none'||cs.visibility==='hidden') return;"
    + "   const w=Math.round(r.width*10)/10, h=Math.round(r.height*10)/10;"
    + "   if(w<24||h<24) small.push({id:el.id||String(el.className).split(' ')[0], w:w, h:h});"
    + " });"
    + " return { screen:s.id, vw:innerWidth, vh:innerHeight, scrollW:s.scrollWidth, scrollH:s.scrollHeight,"
    + "   top:box(kids[0]), stage:box(kids[1]), bottom:box(kids[2]), small:small };"
    + "})()";

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function fail(msg) { failures.push(msg); console.log('FAIL - ' + msg); }
function pass(msg) { console.log('PASS - ' + msg); }
function note(msg) { knownFailures.push(msg); console.log('KNOWN - ' + msg); }

function describe(label, m) {
    const r = o => o ? (o.w + 'x' + o.h + '@y' + o.y) : 'MISSING';
    return '      ' + label.padEnd(9) + 'top ' + r(m.top).padEnd(20) + 'stage ' + r(m.stage).padEnd(20) + 'bottom ' + r(m.bottom);
}

async function main() {
    const server = spawn(process.execPath, [path.join(root, 'tools', 'serve.js'), '4183'], { stdio: 'ignore' });
    const chrome = spawn(chromePath, [
        '--headless=new', '--disable-gpu', '--no-sandbox',
        '--remote-debugging-port=' + port,
        '--user-data-dir=' + profileDir,
        'about:blank'
    ], { stdio: 'ignore' });

    let ws;
    try {
        await delay(800);
        let page = null;
        for (let i = 0; i < 100 && !page; i++) {
            try {
                const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
                page = targets.find(t => t.type === 'page');
            } catch (e) {}
            if (!page) await delay(200);
        }
        if (!page) throw new Error('Chrome DevTools target did not appear');

        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });

        let nextId = 1;
        const pending = new Map();
        ws.addEventListener('message', event => {
            const message = JSON.parse(String(event.data));
            if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
                consoleErrors.push(message.params.entry.text);
            }
            if (!message.id || !pending.has(message.id)) return;
            const handlers = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) handlers.reject(new Error(message.error.message));
            else handlers.resolve(message.result);
        });

        function send(method, params) {
            return new Promise((resolve, reject) => {
                const id = nextId++;
                pending.set(id, { resolve, reject });
                ws.send(JSON.stringify({ id, method, params: params || {} }));
            });
        }

        async function evaluate(expression) {
            const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (result.exceptionDetails) throw new Error('Evaluation failed: ' + result.exceptionDetails.text);
            return result.result.value;
        }

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Log.enable');

        // The app registers a service worker that precaches every asset. A
        // freshly generated sw.js only activates AFTER the page has loaded once,
        // so a single navigation can measure stale CSS/JS and silently pass. Drop
        // the worker and its caches before measuring anything.
        await send('Emulation.setDeviceMetricsOverride', {
            width: VIEWPORTS[0].w, height: VIEWPORTS[0].h, deviceScaleFactor: 1, mobile: false
        });
        await send('Page.navigate', { url: appUrl });
        await delay(2200);
        await evaluate("(async () => { const rs = await navigator.serviceWorker.getRegistrations(); for (const r of rs) { await r.unregister(); } const ks = await caches.keys(); for (const k of ks) { await caches.delete(k); } return { unregistered: rs.length, cachesCleared: ks.length }; })()");
        await send('Page.reload');
        await delay(2200);

        for (const vp of VIEWPORTS) {
            await send('Emulation.setDeviceMetricsOverride', {
                width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false
            });
            await send('Page.navigate', { url: appUrl });
            await delay(2200);

            console.log('\n== ' + vp.name + ' ' + vp.w + 'x' + vp.h + ' ==');
            const results = [];

            for (const screen of SCREENS) {
                await evaluate("window.CognitiveRouter.goHome()");
                await delay(400);
                let reached = true;
                for (const step of screen.steps) {
                    try { await evaluate(step); } catch (e) { reached = false; }
                    await delay(600);
                }
                await evaluate("(() => { if (window.CognitiveMessage) window.CognitiveMessage.dismiss(); return 1; })()");
                await delay(550);

                const m = await evaluate(METRIC);
                if (!m || !m.top || !m.stage || !m.bottom) {
                    fail(vp.name + '/' + screen.name + ': could not measure the screen regions');
                    continue;
                }
                results.push({ name: screen.name, group: screen.group, m });
                console.log(describe(screen.name, m));

                // 1. Vertical stack. Small gaps are legitimate (margins), so the
                //    invariant is "no overlap" plus "no overflow", not "no gap".
                //    Skipped for the legacy screen: its .reality-stage is a
                //    full-bleed container, not a region stacked between siblings.
                if (screen.group === 'composer') {
                    if (m.top.b - m.stage.y > TOL) {
                        fail(vp.name + '/' + screen.name + ': top region overlaps the stage by ' + (m.top.b - m.stage.y) + 'px');
                    }
                    if (m.stage.b - m.bottom.y > TOL) {
                        fail(vp.name + '/' + screen.name + ': stage overlaps the bottom region by ' + (m.stage.b - m.bottom.y) + 'px');
                    }
                }
                if (m.bottom.b > m.vh + TOL) {
                    fail(vp.name + '/' + screen.name + ': bottom region runs ' + (m.bottom.b - m.vh) + 'px past the viewport');
                }

                // 2. No horizontal overflow.
                if (m.scrollW > m.vw + TOL) {
                    fail(vp.name + '/' + screen.name + ': horizontal overflow ' + m.scrollW + ' > ' + m.vw);
                }

                // 3. Tap targets meet the 24px AA floor unless already known.
                for (const t of m.small) {
                    const key = m.screen + ' ' + t.id;
                    if (KNOWN_TARGET_FAILURES.indexOf(key) !== -1) {
                        note(vp.name + '/' + screen.name + ': tap target ' + t.id + ' ' + t.w + 'x' + t.h + ' (acknowledged)');
                    } else {
                        fail(vp.name + '/' + screen.name + ': tap target ' + t.id + ' is ' + t.w + 'x' + t.h + ', below the ' + TAP_FLOOR + 'px floor');
                    }
                }
            }

            // 4. Composer-built games must agree on the top bar. Stage and footer
            //    heights are deliberately NOT compared: games with a bottom
            //    control bar (gng/nback/dual/palm/shopping) are taller than
            //    text-only footers (food/different/pairs), and the stage simply
            //    absorbs the remainder, so cross-game equality is not a real
            //    invariant.
            const composer = results.filter(r => r.group === 'composer');
            if (composer.length > 1) {
                const ref = composer[0].m;
                const agree = key => composer.every(r => Math.abs(r.m[key].h - ref[key].h) <= TOL);
                if (agree('top')) pass(vp.name + ': top-bar height identical across composer games (' + ref.top.h + ')');
                else fail(vp.name + ': top-bar height differs - ' + composer.map(r => r.name + '=' + r.m.top.h).join(', '));
            }
        }

        console.log('\nconsoleErrors=' + JSON.stringify(consoleErrors));
        if (consoleErrors.length) fail('console errors were logged');
        if (knownFailures.length) console.log('knownIssues=' + knownFailures.length);
        const allPass = failures.length === 0;
        console.log('result=' + (allPass ? 'PASS' : 'FAIL') + ' checks=' + (allPass ? 'all' : failures.length + ' failed'));
        if (!allPass) process.exitCode = 1;
        ws.close();
    } finally {
        chrome.kill();
        server.kill();
        await delay(500);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
