import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const gng = require('../js/food/gng.js');
const logic = require('../js/food/gng-logic.js');
const foodData = require('../js/food/food-data.js');

function makeRandom() {
    let seed = 12345;
    return function () {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
}

const ctx = {
    foodData: foodData.FOOD_DATA,
    categoryNames: foodData.CATEGORY_NAMES,
    pickRandom: foodData.pickRandom,
    getFoodId: foodData.getFoodId
};

test('module exposes the seam: mount + pure-logic module', function () {
    assert.equal(typeof gng.mount, 'function');
    assert.equal(typeof logic.generateGngSequence, 'function');
    assert.equal(typeof logic.getGngSignalCategories, 'function');
    assert.equal(typeof logic.isGngGoFor, 'function');
    assert.equal(typeof logic.getAmbiguousGngFoodIds, 'function');
});

test('generateGngSequence returns length trials of the requested image count', function () {
    const seq = logic.generateGngSequence(Object.assign({ length: 40, goCategory: '水果', noGoCategory: '全部', imageCount: 1, random: makeRandom() }, ctx));
    assert.equal(seq.length, 40);
    seq.forEach(function (trial) {
        assert.ok(Array.isArray(trial));
        assert.equal(trial.length, 1);
        assert.ok(trial[0].name && trial[0].category && trial[0].image);
    });
});

test('getGngSignalCategories splits 全部 vs named correctly', function () {
    assert.deepEqual(logic.getGngSignalCategories('水果', '全部', foodData.CATEGORY_NAMES), {
        goCategories: ['水果'],
        noGoCategories: foodData.CATEGORY_NAMES.filter(c => c !== '水果')
    });
    assert.deepEqual(logic.getGngSignalCategories('全部', '全部', foodData.CATEGORY_NAMES), {
        goCategories: foodData.CATEGORY_NAMES.slice(),
        noGoCategories: []
    });
    assert.deepEqual(logic.getGngSignalCategories('水果', '蔬菜', foodData.CATEGORY_NAMES), {
        goCategories: ['水果'],
        noGoCategories: ['蔬菜']
    });
});

test('isGngGoFor matches go category and respects 全部 semantics', function () {
    assert.equal(logic.isGngGoFor([{ category: '水果' }], '水果', '全部'), true);
    assert.equal(logic.isGngGoFor([{ category: '蔬菜' }], '水果', '全部'), false);
    assert.equal(logic.isGngGoFor([{ category: '蔬菜' }], '全部', '水果'), true);
    assert.equal(logic.isGngGoFor([{ category: '水果' }], '全部', '水果'), false);
    assert.equal(logic.isGngGoFor([{ category: 'x' }], '全部', '全部'), true);
});

test('getAmbiguousGngFoodIds is empty for disjoint go/noGo categories', function () {
    const sig = logic.getGngSignalCategories('水果', '蔬菜', foodData.CATEGORY_NAMES);
    const amb = logic.getAmbiguousGngFoodIds(sig.goCategories, sig.noGoCategories, foodData.FOOD_DATA, foodData.getFoodId);
    assert.equal(amb.size, 0);
});