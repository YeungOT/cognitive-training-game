// Whole-layout gate: asserts every screen lays out sanely at every viewport and
// that the composer-built games still agree with each other region by region.
//
// Complements tools/verify-parity.js (bottom control row) and
// tools/verify-games.js (behaviour). This one is about geometry: the vertical
// stack, horizontal overflow, and tap-target floors.
//
// Usage: node tools/verify-layout.js
const { launch, defeatServiceWorker, delay } = require('./lib/cdp-harness');

const appUrl = process.env.APP_URL || 'http://localhost:4183/';
const port = Number(process.env.CDP_PORT || 9352);

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
// top-bar height must match. realityBoard is on the legacy static-markup path
// BY DECISION (2026-10-03, user) and is not being migrated, so it is measured
// for its own sanity only and excluded from cross-screen parity. That is a
// permanent grouping, not a migration backlog.
// `expect` is the screen id that must be visible before anything is measured.
// It is not optional bookkeeping: the gate once measured `foodCategorySelect`
// instead of `foodGame` because a preceding click had not taken effect yet, and
// reported a bogus "top region overlaps the stage by 38px". foodCategorySelect
// is not a composer screen -- its children are [top-bar, category-grid], so its
// second child sits at the same y as the top bar, which reproduces that exact
// 38px overlap and its exact 38px top-bar height. Measuring the wrong screen
// produces numbers indistinguishable from a real layout bug.
const SCREENS = [
    { name: 'palm', group: 'composer', expect: 'palm', steps: ["CognitiveRouter.navigate('palm')"] },
    { name: 'gng', group: 'composer', expect: 'gngGame', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameGngBtn').click()", "document.getElementById('gngStartBtn').click()"] },
    { name: 'nback', group: 'composer', expect: 'nbackGame', steps: ["CognitiveRouter.navigate('nbackModeSelect')", "document.getElementById('singleNbackBtn').click()"] },
    {
        name: 'dual', group: 'composer', expect: 'dualNbackGame',
        steps: [
            "CognitiveRouter.navigate('nbackModeSelect')",
            "document.getElementById('dualNbackBtn').click()",
            "(() => { const a = document.getElementById('dualModality1Select'); a.value = 'position'; a.dispatchEvent(new Event('change')); const b = document.getElementById('dualModality2Select'); b.value = 'image'; b.dispatchEvent(new Event('change')); return 1; })()",
            "document.getElementById('dualStartBtn').click()"
        ]
    },
    { name: 'food', group: 'composer', expect: 'foodGame', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameFoodBtn').click()", "document.querySelector('#foodCategorySelect .category-btn').click()"] },
    {
        name: 'shopping', group: 'composer', expect: 'shoppingGame',
        steps: [
            "CognitiveRouter.navigate('mainMenu')",
            "document.getElementById('gameShoppingBtn').click()",
            "document.getElementById('shoppingStartBtn').click()",
            "document.getElementById('shoppingManualStartBtn').click()"
        ]
    },
    { name: 'different', group: 'composer', expect: 'differentGame', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameDifferentBtn').click()"] },
    { name: 'pairs', group: 'composer', expect: 'pairsGame', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gamePairsBtn').click()", "document.getElementById('pairsStartBtn').click()"] },
    { name: 'stroop', group: 'composer', expect: 'stroopGame', steps: ["document.querySelector('[data-router-target=\"stroopGame\"]').click()"] },
    { name: 'reality', group: 'legacy', expect: 'realityBoard', steps: ["CognitiveRouter.navigate('realityBoard')"] }
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

// A screen must be measured only once it has settled AND is the screen we asked
// for. All of: no `cognitive-screen-transition` on the body, exactly one visible
// screen, that screen's id equal to the entry's `expect`, and the same on a
// second sample (which also lets settings-layout.js finish its rAF toggling).
//
// ROOT CAUSE (found later, by matching reported numbers to measured geometry):
// this gate failed once on `iphone-se/food` ("top region overlaps the stage by
// 38px", top-bar 38 instead of 41.8) and then passed on identical code. Three
// candidate causes were measured and all DISPROVEN:
//   (a) "METRIC picks the outgoing screen because transitions keep two screens
//       non-hidden" -- false: a per-frame probe never saw more than one visible
//       screen across the whole navigation.
//   (b) "`cognitive-screen-transition` forces `position: fixed; inset: 0` and
//       changes the measured geometry" -- false: sampling foodGame every 25ms
//       across the transition boundary gave byte-identical boxes before and
//       after (top y2.8 h41.8, stage y44.6).
//   (c) "METRIC and the settle guard use different visibility predicates, so
//       they can disagree about which screen is visible" -- false: METRIC tests
//       only !hidden while the guard also tests getClientRects(), but a
//       per-frame probe found the two sets identical throughout.
//   The real cause: the gate measured `foodCategorySelect` instead of
//   `foodGame`. That screen is not a composer screen -- its children are
//   [top-bar, category-grid], so its second child sits at the SAME y as the
//   top bar. Measured: top {y:4.7 h:38 b:42.7}, grid {y:4.7}, giving
//   42.7 - 4.7 = 38.0px overlap and a 38px top bar. Both reported numbers
//   reproduce to the decimal. On the intended foodGame the same code measures
//   top {y:2.8 h:41.8}, stage {y:44.6} -> zero overlap.
//
//   116 head-to-head samples of the old fixed-delay strategy against this
//   settle guard produced zero violations in either, which is what ruled
//   timing out entirely. And (c) above was tested directly: the two
//   visibility predicates never disagreed.
//
// The lesson, and the reason `expect` is mandatory on every SCREENS entry:
// "exactly one visible screen" is NOT the same as "the screen I asked for".
// A reachable wrong screen is far more dangerous than a moving one, because
// it yields numbers indistinguishable from a real layout defect.
const SETTLE_STATE = "(() => { const vis = [...document.querySelectorAll('.app-screen')].filter(x => !x.classList.contains('hidden') && x.getClientRects().length > 0); return { n: vis.length, ids: vis.map(x => x.id).join(','), transitioning: document.body.classList.contains('cognitive-screen-transition') }; })()";

function fail(msg) { failures.push(msg); console.log('FAIL - ' + msg); }
function pass(msg) { console.log('PASS - ' + msg); }
function note(msg) { knownFailures.push(msg); console.log('KNOWN - ' + msg); }

function describe(label, m) {
    const r = o => o ? (o.w + 'x' + o.h + '@y' + o.y) : 'MISSING';
    return '      ' + label.padEnd(9) + 'top ' + r(m.top).padEnd(20) + 'stage ' + r(m.stage).padEnd(20) + 'bottom ' + r(m.bottom);
}

async function main() {
    let browser = null;
    try {
        browser = await launch({
            servePort: 4183,
            cdpPort: port,
            appUrl: appUrl,
            errors: consoleErrors,
            collectExceptions: false,
            profilePrefix: 'cognitive-layout',
            deviceMetrics: { width: VIEWPORTS[0].w, height: VIEWPORTS[0].h, deviceScaleFactor: 1, mobile: false }
        });
        const { send, evaluate } = browser;

        // Each Page.navigate reloads the document, which re-runs boot. Without
        // waiting for boot to finish, goHome() and the per-screen steps below can
        // run while the router is still being wired, and the gate then reports
        // "never reached <screen>" for whichever screen happened to be first.
        // That is a gate bug, not an app bug, and it is intermittent: which
        // screen failed varied between runs.
        async function waitForBoot() {
            for (let i = 0; i < 80; i++) {
                const booted = await evaluate("(() => { const l = document.getElementById('bootLoader'); return (!l || l.classList.contains('hidden') || l.getClientRects().length === 0) && document.readyState === 'complete' && !!window.CognitiveRouter; })()").catch(() => false);
                if (booted) return true;
                await delay(250);
            }
            return false;
        }

        // See SETTLE_STATE above for why a fixed delay is not enough. Requiring
        // `expect` is the part that matters: "exactly one visible screen" is
        // satisfied just as well by the screen we were trying to LEAVE, which
        // is precisely how this gate measured foodCategorySelect instead of
        // foodGame and invented a layout bug that never existed.
        async function settleLayout(expect) {
            for (let i = 0; i < 50; i++) {
                const s = await evaluate(SETTLE_STATE).catch(() => null);
                if (s && s.n === 1 && !s.transitioning && s.ids === expect) {
                    await delay(120);
                    const again = await evaluate(SETTLE_STATE).catch(() => null);
                    if (again && again.n === 1 && !again.transitioning && again.ids === expect) return true;
                }
                await delay(120);
            }
            return false;
        }

        // The app registers a service worker that precaches every asset. A
        // freshly generated sw.js only activates AFTER the page has loaded once,
        // so a single navigation can measure stale CSS/JS and silently pass.
        // The launch above already navigated once; now drop the worker and its
        // caches and reload so everything measured comes from disk.
        await defeatServiceWorker(evaluate);
        await send('Page.reload');
        await delay(2200);

        for (const vp of VIEWPORTS) {
            await send('Emulation.setDeviceMetricsOverride', {
                width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false
            });
            await send('Page.navigate', { url: appUrl });
            await delay(2200);
            await waitForBoot();

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

                if (!await settleLayout(screen.expect)) {
                    const seen = await evaluate(SETTLE_STATE).catch(() => null);
                    fail(vp.name + '/' + screen.name + ': never reached "' + screen.expect + '" (saw ' + (seen ? (seen.n + ' visible: ' + seen.ids + ', transitioning=' + seen.transitioning) : 'nothing') + ') -- refusing to measure the wrong screen');
                    continue;
                }
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
                        fail(vp.name + '/' + screen.name + ': top region overlaps the stage by ' + (m.top.b - m.stage.y) + 'px (measured screen=' + m.screen + ' top=' + JSON.stringify(m.top) + ' stage=' + JSON.stringify(m.stage) + ')');
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
    } finally {
        if (browser) await browser.close();
        await delay(500);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
