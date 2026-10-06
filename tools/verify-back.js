// Back-button gate. Asserts every game's back button actually navigates away,
// by dispatching a real mouse click at the button's on-screen centre.
//
// Why this exists: each composer-built game declares a back button through the
// shared Game Screen (`backId`), but the Game Screen only CREATES the element.
// Each game is separately responsible for wiring its click handler, and a
// missing handler produces a button that renders perfectly and does nothing --
// which no existence check can catch. `verify-games.js` asserted only that
// `#palmBackBtn` was present in the DOM, so the dead button sailed through.
//
// Usage: node tools/verify-back.js
const { launch, defeatServiceWorker, delay } = require('./lib/cdp-harness');

const appUrl = 'http://localhost:4186/';
const port = Number(process.env.CDP_PORT || 9342);

// steps mirror tools/verify-layout.js so both gates agree on how to reach a game.
const SCREENS = [
    // Palm is entered from a home tile (data-router-target), not the registry,
    // so click the real tile rather than calling navigate() directly.
    { name: 'palm', backId: 'palmBackBtn', expectBackTo: 'home', steps: ["document.querySelector('[data-router-target=\"palm\"]').click()"] },
    { name: 'gng', backId: 'gngBackBtn', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameGngBtn').click()", "document.getElementById('gngStartBtn').click()"] },
    { name: 'nback', backId: 'nbackBackBtn', steps: ["CognitiveRouter.navigate('nbackModeSelect')", "document.getElementById('singleNbackBtn').click()"] },
    {
        name: 'dual',
        backId: 'dualNbackBackBtn',
        steps: [
            "CognitiveRouter.navigate('nbackModeSelect')",
            "document.getElementById('dualNbackBtn').click()",
            "(() => { const a = document.getElementById('dualModality1Select'); a.value = 'position'; a.dispatchEvent(new Event('change')); const b = document.getElementById('dualModality2Select'); b.value = 'image'; b.dispatchEvent(new Event('change')); return 1; })()",
            "document.getElementById('dualStartBtn').click()"
        ]
    },
    { name: 'food', backId: 'foodBackBtn', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameFoodBtn').click()", "document.querySelector('#foodCategorySelect .category-btn').click()"] },
    {
        name: 'shopping',
        backId: 'shoppingBackBtn',
        steps: [
            "CognitiveRouter.navigate('mainMenu')",
            "document.getElementById('gameShoppingBtn').click()",
            "document.getElementById('shoppingStartBtn').click()",
            "document.getElementById('shoppingManualStartBtn').click()"
        ]
    },
    { name: 'different', backId: 'differentBackBtn', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gameDifferentBtn').click()"] },
    { name: 'pairs', backId: 'pairsBackBtn', steps: ["CognitiveRouter.navigate('mainMenu')", "document.getElementById('gamePairsBtn').click()", "document.getElementById('pairsStartBtn').click()"] },
    { name: 'stroop', backId: 'stroopBackBtn', expectBackTo: 'home', steps: ["document.querySelector('[data-router-target=\"stroopGame\"]').click()"] },
    { name: 'reality', backId: 'realityBackBtn', steps: ["CognitiveRouter.navigate('realityBoard')"] }
];

const failures = [];
const errors = [];
function fail(m) { failures.push(m); console.log('FAIL - ' + m); }
function pass(m) { console.log('PASS - ' + m); }

async function main() {
    let browser = null;
    try {
        browser = await launch({
            servePort: 4186,
            cdpPort: port,
            appUrl: appUrl,
            errors: errors,
            profilePrefix: 'cognitive-back',
            deviceMetrics: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }
        });
        const { send, evaluate } = browser;
        // The app precaches behind a service worker; a fresh sw.js only activates
        // after a load, so measuring without this reads stale assets.
        await defeatServiceWorker(evaluate);
        await send('Page.reload');
        await delay(2400);
        for (let i = 0; i < 60; i++) {
            const booted = await evaluate("(() => { const l = document.getElementById('bootLoader'); return (!l || l.classList.contains('hidden') || l.getClientRects().length === 0) && document.readyState === 'complete' && !!window.CognitiveRouter; })()").catch(() => false);
            if (booted) break;
            await delay(250);
        }

        const VISIBLE = "(() => { const s = [...document.querySelectorAll('.app-screen')].filter(x => !x.classList.contains('hidden') && x.getClientRects().length > 0); return s.map(x => x.id).join(',') || 'none'; })()";

        for (const screen of SCREENS) {
            await evaluate("window.CognitiveRouter.goHome()");
            await delay(500);
            let reached = true;
            for (const step of screen.steps) {
                try { await evaluate(step); } catch (e) { reached = false; }
                await delay(600);
            }
            await evaluate("(() => { if (window.CognitiveMessage) window.CognitiveMessage.dismiss(); return 1; })()");
            await delay(550);

            const before = await evaluate(VISIBLE);
            const box = await evaluate(`(() => {
                const el = document.getElementById(${JSON.stringify(screen.backId)});
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
            })()`);

            if (!box) {
                fail(screen.name + ': back button #' + screen.backId + ' does not exist');
                continue;
            }
            if (box.w < 1 || box.h < 1) {
                fail(screen.name + ': back button #' + screen.backId + ' exists but is not visible');
                continue;
            }

            // Real dispatched click at the button centre, so hit-testing counts too.
            await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1, buttons: 1 });
            await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1, buttons: 0 });
            await delay(800);
            const after = await evaluate(VISIBLE);

            if (!reached) {
                fail(screen.name + ': could not reach the game screen, so the back test is inconclusive (visible=' + before + ')');
            } else if (after === before) {
                fail(screen.name + ': clicking #' + screen.backId + ' did NOT navigate away (still on "' + before + '") -- button is dead');
            } else if (screen.expectBackTo && after !== screen.expectBackTo) {
                fail(screen.name + ': #' + screen.backId + ' went to "' + after + '" but should return to "' + screen.expectBackTo + '"');
            } else {
                pass(screen.name + ': #' + screen.backId + ' navigates ' + before + ' -> ' + after);
            }
        }

        console.log('');
        if (errors.length) {
            console.log('page errors:');
            errors.forEach(e => console.log('  ' + e));
            failures.push('page errors: ' + errors.length);
        }
    } finally {
        if (browser) await browser.close();
    }

    if (failures.length) {
        console.log('\n' + failures.length + ' check(s) failed');
        process.exit(1);
    }
    console.log('\nAll back-button checks passed');
}

main().catch(e => { console.error('GATE ERROR: ' + e.message); process.exit(1); });
