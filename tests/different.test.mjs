import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const different = require('../js/food/different.js');
const foodData = require('../js/food/food-data.js');

const FOOD_DATA = foodData.FOOD_DATA;
const CATEGORY_NAMES = foodData.CATEGORY_NAMES;
const shuffle = foodData.shuffle;
const pickRandom = foodData.pickRandom;

test('module exposes the seam: mount + buildDifferentRound', function () {
    assert.equal(typeof different.mount, 'function');
    assert.equal(typeof different.buildDifferentRound, 'function');
});

test('mount returns null without a document or foodData', function () {
    assert.equal(different.mount(null), null);
    assert.equal(different.mount(undefined), null);
    assert.equal(different.mount({ ownerDocument: { getElementById: function () { return null; } } }, {}), null);
});

test('buildDifferentRound returns count items with exactly one odd item', function () {
    [3, 4, 5, 6].forEach(function (count) {
        const r = different.buildDifferentRound(count, FOOD_DATA, CATEGORY_NAMES, shuffle, pickRandom);
        assert.ok(Array.isArray(r.items));
        assert.equal(r.items.length, count);
        const corrects = r.items.filter(function (i) { return i.isCorrect; });
        assert.equal(corrects.length, 1);
        r.items.forEach(function (i) {
            assert.ok(i.name && i.image && i.category);
            assert.equal(typeof i.isCorrect, 'boolean');
        });
    });
});

test('buildDifferentRound oddItem is the raw food item matching the correct card', function () {
    const r = different.buildDifferentRound(4, FOOD_DATA, CATEGORY_NAMES, shuffle, pickRandom);
    assert.ok(r.oddItem && r.oddItem.name && r.oddItem.image && r.oddItem.category);
    assert.equal('isCorrect' in r.oddItem, false);
    const correct = r.items.find(function (i) { return i.isCorrect; });
    assert.equal(correct.name, r.oddItem.name);
});

test('buildDifferentRound odd category differs from the shared common category', function () {
    const r = different.buildDifferentRound(4, FOOD_DATA, CATEGORY_NAMES, shuffle, pickRandom);
    const commonCats = new Set(r.items.filter(function (i) { return !i.isCorrect; }).map(function (i) { return i.category; }));
    assert.equal(commonCats.size, 1);
    assert.notEqual([...commonCats][0], r.oddItem.category);
});