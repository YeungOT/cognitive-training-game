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
