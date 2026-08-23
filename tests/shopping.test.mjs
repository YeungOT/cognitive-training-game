import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const shopping = require('../js/food/shopping.js');
const logic = require('../js/food/shopping-logic.js');
const foodData = require('../js/food/food-data.js');

const FOOD_DATA = foodData.FOOD_DATA;
const shuffle = foodData.shuffle;
const getFoodId = foodData.getFoodId;

test('module exposes the seam: mount + pure-logic module + option tables', function () {
    assert.equal(typeof shopping.mount, 'function');
    assert.equal(typeof logic.buildShoppingRound, 'function');
    assert.equal(logic.STANDARD_MEMORY_OPTIONS.length, 5);
    assert.equal(logic.ORDER_MEMORY_OPTIONS.length, 4);
});

test('mount returns null without a document or required deps', function () {
    assert.equal(shopping.mount(null), null);
    assert.equal(shopping.mount(undefined), null);
    assert.equal(shopping.mount({ ownerDocument: { getElementById: function () { return null; } } }, {}), null);
    assert.equal(shopping.mount({ ownerDocument: { getElementById: function () { return null; } } }, { foodData: foodData }), null);
});

test('buildShoppingRound returns a list of listCount and a grid of choiceCount', function () {
    [[3, 6], [3, 4], [4, 6], [5, 8], [5, 6], [2, 4]].forEach(function (pair) {
        const r = logic.buildShoppingRound(pair[0], pair[1], FOOD_DATA, shuffle, getFoodId);
        assert.ok(Array.isArray(r.list) && Array.isArray(r.gridItems));
        assert.equal(r.list.length, pair[0]);
        assert.equal(r.gridItems.length, pair[1]);
        const listNames = new Set(r.list.map(function (i) { return i.name; }));
        assert.equal(listNames.size, pair[0]);
        const gridIds = new Set(r.gridItems.map(getFoodId));
        assert.equal(gridIds.size, pair[1]);
    });
});

test('buildShoppingRound grid targets are the list, distractors are not', function () {
    const r = logic.buildShoppingRound(3, 6, FOOD_DATA, shuffle, getFoodId);
    const listIds = new Set(r.list.map(getFoodId));
    const targets = r.gridItems.filter(function (i) { return i.isTarget; });
    const distractors = r.gridItems.filter(function (i) { return !i.isTarget; });
    assert.equal(targets.length, 3);
    assert.equal(distractors.length, 3);
    targets.forEach(function (t) { assert.equal(listIds.has(getFoodId(t)), true); });
    distractors.forEach(function (d) { assert.equal(listIds.has(getFoodId(d)), false); });
});

test('buildShoppingRound produces food items with name/image/category', function () {
    const r = logic.buildShoppingRound(4, 6, FOOD_DATA, shuffle, getFoodId);
    r.list.forEach(function (i) {
        assert.ok(i.name && i.image && i.category);
    });
});