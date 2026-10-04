import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cssDir = join(here, '..', 'css');

const cssFiles = readdirSync(cssDir).filter(f => f.endsWith('.css'));
const allCss = cssFiles.map(f => readFileSync(join(cssDir, f), 'utf8')).join('\n');

// Bottom-row controls that must render identically in every game. A game is
// allowed to style its own content (.side, .gesture-image, #swapBtn) but must
// not re-scope one of these: an ID selector outranks the shared class, so a
// per-game copy silently opts that game out of every shared change. That is
// what caused the Palm phone footer to drift out of step with the others.
const SHARED_ROW_CLASSES = [
    'speed-control',
    'speed-btn',
    'speed-display',
    'play-btn',
    'bottom-controls'
];

// Added after two real bugs slipped past the checks above. Both were the same
// shape: a more specific selector silently overrode a shared value, so the
// change landed on some screens and not others, and nothing complained.
//   - #mainMenu/.foodCategorySelect/.nbackModeSelect and .home-header pinned
//     their own title gap, so --screen-title-gap never reached the tile screens
//     (an ID selector outranks a class selector).
//   - .reality-edit-btn was omitted from the phone rule sizing .back-btn and
//     .hamburger-btn, so it rendered 44px beside two 38px buttons.
// Each test below encodes one of those, so the CLASS of bug cannot recur
// quietly even where the specific instance is fixed.

test('every title gap consumes --screen-title-gap', function () {
    const offenders = [];
    // Any rule block whose selector mentions a header, and whose body sets a
    // margin-bottom, must use the token rather than its own number.
    const re = /([^{}]*menu-header[^{}]*)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(allCss)) !== null) {
        const selector = m[1].trim().replace(/\s+/g, ' ');
        // ":not(.menu-header)" styles OTHER elements (the content row below the
        // header) and is not a header gap at all.
        if (selector.includes(':not(.menu-header)')) continue;
        const body = m[2];
        const mb = body.match(/margin-bottom:\s*([^;]+);/);
        if (!mb) continue;
        // --settings-header-gap is a declared alias of --screen-title-gap, so
        // consuming it is consuming the same token.
        if (!mb[1].includes('--screen-title-gap') && !mb[1].includes('--settings-header-gap')) {
            offenders.push(selector + ' { margin-bottom: ' + mb[1].trim() + ' }');
        }
    }
    assert.deepEqual(offenders, [],
        'title gaps must come from --screen-title-gap so every titled screen moves together: ' + offenders.join(' | '));
});

test('the reality edit button is sized by the same rule as the menu buttons', function () {
    const unified = readFileSync(join(cssDir, 'unified.css'), 'utf8');
    // Whatever rule gives .back-btn/.hamburger-btn their phone size must name
    // .reality-edit-btn too, otherwise it falls back to whatever width another
    // stylesheet computes and silently stops matching its neighbours.
    assert.match(unified, /\.hamburger-btn,[\s\S]{0,200}?\.action-btn\.reality-edit-btn\s*\{/,
        '.reality-edit-btn must appear in the same selector list as .hamburger-btn in unified.css');
});

test('no game scopes a shared bottom-row control with an ID selector', function () {
    const offenders = [];
    for (const cls of SHARED_ROW_CLASSES) {
        // Flags "#someId .cls" where .cls is the FINAL selector in the rule - i.e.
        // the game is re-scoping the shared control itself. A descendant chain
        // like "#game .bottom-controls .center-group" is legitimate per-game
        // layout and is deliberately not matched.
        const re = new RegExp('#[A-Za-z][\\w-]*(?:\\s+[.#][\\w-]+)*\\s+\\.' + cls + '(?!\\s*[.#][\\w-])(?!:)', 'g');
        const matches = allCss.match(re);
        if (matches) offenders.push(cls + ' -> ' + [...new Set(matches)].join(', '));
    }
    assert.deepEqual(offenders, [],
        'per-game ID-scoped copies of shared bottom-row controls drift out of sync: ' + offenders.join(' | '));
});

test('bottom-row spec tokens are defined once in variables.css', function () {
    const vars = readFileSync(join(cssDir, 'variables.css'), 'utf8');
    assert.match(vars, /--row-action-h:\s*max\(38px/, 'missing --row-action-h with its 38px phone floor');
    assert.match(vars, /--row-action-min-w:\s*max\(88px/, 'missing --row-action-min-w with its 88px floor');
});

test('speed control height is bound to the action row, not a separate number', function () {
    const vars = readFileSync(join(cssDir, 'variables.css'), 'utf8');
    assert.match(vars, /--control-h:\s*var\(--row-action-h\)/,
        '--control-h must resolve to --row-action-h so the speed control cannot drift from the action bar');
});

test('the phone media query does not re-pin the shared row controls', function () {
    // The phone block is allowed to pin magnify/speed glyph buttons, but pinning
    // .play-btn or the speed control there re-introduces exactly the drift the
    // tokens removed (a phone-only --control-h made the speed control 32px).
    const unified = readFileSync(join(cssDir, 'unified.css'), 'utf8');
    const phoneStart = unified.indexOf('@media (max-height: 500px)');
    assert.ok(phoneStart > -1, 'phone media query not found');
    const phone = unified.slice(phoneStart);
    assert.doesNotMatch(phone, /--control-h:\s*\d/, 'phone block re-pins --control-h to a literal');
    const pinnedPlay = /^\s*\.play-btn\s*,?\s*$/m;
    assert.doesNotMatch(phone, pinnedPlay, 'phone block groups .play-btn with other selectors again');
});
