import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createNameVisibility } = require('../js/food/name-visibility.js');

function fakeEl() {
    const classes = new Set();
    return {
        classList: {
            toggle: function (c, on) { if (on) classes.add(c); else classes.delete(c); },
            contains: function (c) { return classes.has(c); }
        },
        style: {},
        _classes: classes
    };
}

test('isEnabled starts true and reflects set/toggle', function () {
    const nv = createNameVisibility({ foodRoot: fakeEl() });
    assert.equal(nv.isEnabled, true);
    nv.set(false);
    assert.equal(nv.isEnabled, false);
    nv.set(true);
    assert.equal(nv.isEnabled, true);
});

test('toggle flips the state and applies', function () {
    const foodRoot = fakeEl();
    const nv = createNameVisibility({ foodRoot: foodRoot });
    nv.toggle();
    assert.equal(nv.isEnabled, false);
    assert.equal(foodRoot._classes.has('hide-names'), true);
    nv.toggle();
    assert.equal(nv.isEnabled, true);
    assert.equal(foodRoot._classes.has('hide-names'), false);
});

test('apply toggles hide-names, opacity, and badge on-state across roots', function () {
    const foodRoot = fakeEl();
    const shoppingRoot = fakeEl();
    const magnifyName = fakeEl();
    magnifyName.style = {};
    const foodBadge = fakeEl();
    const shoppingBadge = fakeEl();
    const nv = createNameVisibility({
        foodRoot: foodRoot,
        shoppingRoot: shoppingRoot,
        magnifyName: magnifyName,
        foodBadge: foodBadge,
        shoppingBadge: shoppingBadge
    });

    nv.set(false);
    nv.apply();
    assert.equal(foodRoot._classes.has('hide-names'), true);
    assert.equal(shoppingRoot._classes.has('hide-names'), true);
    assert.equal(magnifyName.style.opacity, '0');
    assert.equal(foodBadge._classes.has('on'), false);
    assert.equal(shoppingBadge._classes.has('on'), false);

    nv.set(true);
    nv.apply();
    assert.equal(foodRoot._classes.has('hide-names'), false);
    assert.equal(shoppingRoot._classes.has('hide-names'), false);
    assert.equal(magnifyName.style.opacity, '1');
    assert.equal(foodBadge._classes.has('on'), true);
    assert.equal(shoppingBadge._classes.has('on'), true);
});

test('apply is a no-op for missing optional elements', function () {
    const nv = createNameVisibility({});
    nv.set(false);
    nv.apply();
    assert.equal(nv.isEnabled, false);
});
