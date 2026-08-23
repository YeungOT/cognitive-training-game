import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const foodData = require('../js/food/food-data.js');

test('FOOD_DATA is a non-empty array of food items', function () {
    assert.ok(Array.isArray(foodData.FOOD_DATA));
    assert.ok(foodData.FOOD_DATA.length > 0);
    for (const item of foodData.FOOD_DATA) {
        assert.ok(typeof item.name === 'string' && item.name.length > 0);
        assert.ok(typeof item.category === 'string' && item.category.length > 0);
        assert.ok(typeof item.image === 'string' && item.image.length > 0);
    }
});

test('getFoodId falls back to name when id is absent', function () {
    assert.equal(foodData.getFoodId({ name: '蘋果' }), '蘋果');
    assert.equal(foodData.getFoodId({ name: '蘋果', id: 'apple-fruit' }), 'apple-fruit');
});

test('CATEGORY_NAMES has all seven categories', function () {
    assert.deepEqual(foodData.CATEGORY_NAMES, ['水果', '蔬菜', '肉類', '點心', '堅果', '甜品', '海鮮']);
});

test('CATEGORY_ICONS maps every category name to an icon', function () {
    for (const name of foodData.CATEGORY_NAMES) {
        assert.ok(typeof foodData.CATEGORY_ICONS[name] === 'string' && foodData.CATEGORY_ICONS[name].length > 0);
    }
});

test('QUESTION_TEMPLATES has a template for every category', function () {
    for (const name of foodData.CATEGORY_NAMES) {
        assert.ok(typeof foodData.QUESTION_TEMPLATES[name] === 'string');
    }
});

test('shuffle returns a permutation of the same length', function () {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = foodData.shuffle(input);
    assert.equal(result.length, input.length);
    assert.deepEqual(result.slice().sort(function (a, b) { return a - b; }), input.slice().sort(function (a, b) { return a - b; }));
    // input is not mutated
    assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('pickRandom returns a member of the array', function () {
    const input = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
        assert.ok(input.indexOf(foodData.pickRandom(input)) !== -1);
    }
});
