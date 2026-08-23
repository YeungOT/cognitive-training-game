import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const food = require('../js/food/food.js');
const logic = require('../js/food/food-logic.js');
const foodData = require('../js/food/food-data.js');

const FOOD_DATA = foodData.FOOD_DATA;
const CATEGORY_NAMES = foodData.CATEGORY_NAMES;
const getFoodId = foodData.getFoodId;

test('module exposes the seam: mount + pure-logic module', function () {
    assert.equal(typeof food.mount, 'function');
    assert.equal(typeof logic.getFoodQuestionHtml, 'function');
    assert.equal(typeof logic.getAvailableItems, 'function');
    assert.equal(typeof logic.isCategoryComplete, 'function');
    assert.equal(typeof logic.areAllCategoriesComplete, 'function');
    assert.equal(typeof logic.pickFoodDistractors, 'function');
});

test('mount returns null without a document/foodData/logic/view', function () {
    assert.equal(food.mount(null), null);
    assert.equal(food.mount(undefined), null);
    assert.equal(food.mount({ ownerDocument: { getElementById: function () { return null; } } }, {}), null);
    assert.equal(food.mount({ ownerDocument: { getElementById: function () { return null; } } }, { foodData: foodData }), null);
    assert.equal(food.mount({ ownerDocument: { getElementById: function () { return null; } } }, { foodData: foodData, logic: logic }), null);
});

test('getFoodQuestionHtml uses template when present, falls back otherwise', function () {
    const tpl = { '水果': '哪一個是 <span class="category-highlight">水果</span> ？' };
    assert.equal(logic.getFoodQuestionHtml('水果', tpl), tpl['水果']);
    assert.equal(logic.getFoodQuestionHtml('其他', {}), '哪一個是 <span class="category-highlight">其他</span> ？');
});

test('getAvailableItems filters by category and excludes used ids', function () {
    const cat = FOOD_DATA[0].category;
    const used = new Set([getFoodId(FOOD_DATA[0])]);
    const av = logic.getAvailableItems(cat, FOOD_DATA, used, getFoodId);
    assert.ok(av.length > 0);
    av.forEach(function (item) {
        assert.equal(item.category, cat);
        assert.equal(used.has(getFoodId(item)), false);
    });
    const expected = FOOD_DATA.filter(function (i) { return i.category === cat && !used.has(getFoodId(i)); });
    assert.equal(av.length, expected.length);
});

test('isCategoryComplete true only when no available items remain', function () {
    const cat = FOOD_DATA[0].category;
    const allIds = new Set(FOOD_DATA.filter(function (i) { return i.category === cat; }).map(getFoodId));
    assert.equal(logic.isCategoryComplete(cat, FOOD_DATA, allIds, getFoodId), true);
    assert.equal(logic.isCategoryComplete(cat, FOOD_DATA, new Set(), getFoodId), false);
});

test('areAllCategoriesComplete reflects the categoryCompleted map', function () {
    const allDone = Object.fromEntries(CATEGORY_NAMES.map(function (c) { return [c, true]; }));
    assert.equal(logic.areAllCategoriesComplete(CATEGORY_NAMES, allDone), true);
    allDone[CATEGORY_NAMES[0]] = false;
    assert.equal(logic.areAllCategoriesComplete(CATEGORY_NAMES, allDone), false);
    assert.equal(logic.areAllCategoriesComplete(CATEGORY_NAMES, {}), false);
});

test('pickFoodDistractors returns imageCount-1 unique distractors excluding the correct name', function () {
    const shuffle = foodData.shuffle;
    const pickRandom = foodData.pickRandom;
    for (let i = 0; i < 10; i++) {
        const target = pickRandom(CATEGORY_NAMES);
        const correct = pickRandom(FOOD_DATA.filter(function (x) { return x.category === target; }));
        const distractors = logic.pickFoodDistractors(target, correct, 4, FOOD_DATA, CATEGORY_NAMES, new Set(), shuffle, pickRandom, getFoodId);
        assert.equal(distractors.length, 3);
        assert.ok(distractors.every(function (d) { return d.name !== correct.name; }));
        assert.equal(new Set(distractors.map(function (d) { return d.name; })).size, 3);
    }
});