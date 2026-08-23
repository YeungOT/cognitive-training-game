(function (global) {
    'use strict';

    // =============================================================
    // 食物分類遊戲 — pure logic helpers
    // =============================================================
    //
    // DOM-free, dependency-free helpers for the food game: question template
    // lookup, available/completion checks, and distractor selection. No
    // lifecycle, no state mutation (state is passed in per call).

    function getFoodQuestionHtml(category, questionTemplates) {
        return questionTemplates[category] || `哪一個是 <span class="category-highlight">${category}</span> ？`;
    }

    function getAvailableItems(category, foodData, usedFoods, getFoodId) {
        return foodData.filter(item => item.category === category && !usedFoods.has(getFoodId(item)));
    }

    function isCategoryComplete(category, foodData, usedFoods, getFoodId) {
        return getAvailableItems(category, foodData, usedFoods, getFoodId).length === 0;
    }

    function areAllCategoriesComplete(categoryNames, categoryCompleted) {
        return categoryNames.every(cat => categoryCompleted[cat]);
    }

    // Distractor selection for a question (same rules as the original inline
    // logic: avoid the correct name, avoid 肉類/海鮮 cross-over).
    function pickFoodDistractors(targetCat, correct, imageCount, foodData, categoryNames, usedFoods, shuffle, pickRandom, getFoodId) {
        const distractorCount = imageCount - 1;
        let distractors = [];
        let otherCats = categoryNames.filter(c => c !== targetCat);
        if (targetCat === '肉類') otherCats = otherCats.filter(c => c !== '海鮮');
        if (targetCat === '海鮮') otherCats = otherCats.filter(c => c !== '肉類');

        let pool = [];
        for (const cat of otherCats) {
            pool.push(...getAvailableItems(cat, foodData, usedFoods, getFoodId));
        }
        pool = shuffle(pool);
        for (const item of pool) {
            if (distractors.length >= distractorCount) break;
            if (item.name !== correct.name) distractors.push(item);
        }
        if (distractors.length < distractorCount) {
            let usedPool = foodData.filter(item => usedFoods.has(getFoodId(item)) && item.name !== correct.name &&
                item.category !== targetCat);
            if (targetCat === '肉類') usedPool = usedPool.filter(item => item.category !== '海鮮');
            if (targetCat === '海鮮') usedPool = usedPool.filter(item => item.category !== '肉類');
            const shuffledUsed = shuffle(usedPool);
            for (const item of shuffledUsed) {
                if (distractors.length >= distractorCount) break;
                if (!distractors.some(d => d.name === item.name)) distractors.push(item);
            }
        }
        while (distractors.length < distractorCount) {
            const fallback = foodData.filter(item => item.name !== correct.name && item.category !== targetCat);
            if (targetCat === '肉類') {
                const filtered = fallback.filter(item => item.category !== '海鮮');
                if (filtered.length > 0) { const pick = pickRandom(filtered); if (!distractors.some(d => d.name === pick
                            .name)) { distractors.push(pick); continue; } }
            } else if (targetCat === '海鮮') {
                const filtered = fallback.filter(item => item.category !== '肉類');
                if (filtered.length > 0) { const pick = pickRandom(filtered); if (!distractors.some(d => d.name === pick
                            .name)) { distractors.push(pick); continue; } }
            }
            const pick = pickRandom(fallback);
            if (pick && !distractors.some(d => d.name === pick.name)) distractors.push(pick);
            else break;
        }
        return distractors;
    }

    var api = {
        getFoodQuestionHtml: getFoodQuestionHtml,
        getAvailableItems: getAvailableItems,
        isCategoryComplete: isCategoryComplete,
        areAllCategoriesComplete: areAllCategoriesComplete,
        pickFoodDistractors: pickFoodDistractors
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveFoodLogic = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);