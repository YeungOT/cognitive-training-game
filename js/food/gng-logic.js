(function (global) {
    'use strict';

    // =============================================================
    // Go/No Go — pure logic helpers
    // =============================================================
    //
    // DOM-free sequence generation and go/no-go classification. No lifecycle,
    // no state mutation.

    function getGngSignalCategories(goCategory, noGoCategory, categoryNames) {
        if (goCategory === '全部' && noGoCategory === '全部') {
            return { goCategories: categoryNames.slice(), noGoCategories: [] };
        }
        if (goCategory === '全部') {
            return {
                goCategories: categoryNames.filter(c => c !== noGoCategory),
                noGoCategories: [noGoCategory],
            };
        }
        if (noGoCategory === '全部') {
            return {
                goCategories: [goCategory],
                noGoCategories: categoryNames.filter(c => c !== goCategory),
            };
        }
        if (goCategory === noGoCategory) {
            return { goCategories: [goCategory], noGoCategories: [] };
        }
        return { goCategories: [goCategory], noGoCategories: [noGoCategory] };
    }

    function getAmbiguousGngFoodIds(goCategories, noGoCategories, foodData, getFoodId) {
        const goSet = new Set(goCategories);
        const noGoSet = new Set(noGoCategories);
        const flagsByName = new Map();
        for (const item of foodData) {
            if (!flagsByName.has(item.name)) flagsByName.set(item.name, { go: false, noGo: false });
            const flags = flagsByName.get(item.name);
            if (goSet.has(item.category)) flags.go = true;
            if (noGoSet.has(item.category)) flags.noGo = true;
        }
        const ambiguous = new Set();
        for (const item of foodData) {
            const flags = flagsByName.get(item.name);
            if (flags.go && flags.noGo) ambiguous.add(getFoodId(item));
        }
        return ambiguous;
    }

    function pickGngTrialItems(categories, count, excludeIds, foodData, pickRandom, getFoodId, random) {
        const category = pickRandom(categories);
        const pool = foodData.filter(item => item.category === category && !excludeIds.has(getFoodId(item)));
        const result = [];
        const remaining = pool.slice();
        for (let i = 0; i < count; i++) {
            if (remaining.length === 0) remaining.push(...pool);
            result.push(remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
        }
        return result;
    }

    function generateGngSequence(options) {
        options = options || {};
        const length = options.length || 50;
        const goCategory = options.goCategory;
        const noGoCategory = options.noGoCategory;
        const imageCount = options.imageCount || 1;
        const foodData = options.foodData;
        const categoryNames = options.categoryNames;
        const pickRandom = options.pickRandom;
        const getFoodId = options.getFoodId;
        const random = options.random || Math.random;
        const { goCategories, noGoCategories } = getGngSignalCategories(goCategory, noGoCategory, categoryNames);
        const excludeIds = getAmbiguousGngFoodIds(goCategories, noGoCategories, foodData, getFoodId);
        const seq = [];
        for (let i = 0; i < length; i++) {
            const isGoTrial = noGoCategories.length === 0 || random() < 0.5;
            const categoryPool = isGoTrial ? goCategories : noGoCategories;
            seq.push(pickGngTrialItems(categoryPool, imageCount, excludeIds, foodData, pickRandom, getFoodId, random));
        }
        return seq;
    }

    function isGngGoFor(items, goCategory, noGoCategory) {
        if (goCategory === '全部') {
            if (noGoCategory === '全部') return true;
            return items.some(item => item.category !== noGoCategory);
        }
        return items.some(item => item.category === goCategory);
    }

    var api = {
        getGngSignalCategories: getGngSignalCategories,
        getAmbiguousGngFoodIds: getAmbiguousGngFoodIds,
        pickGngTrialItems: pickGngTrialItems,
        generateGngSequence: generateGngSequence,
        isGngGoFor: isGngGoFor
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveGngLogic = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);