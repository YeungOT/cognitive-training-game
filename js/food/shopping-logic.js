(function (global) {
    'use strict';

    // =============================================================
    // 買餸記憶遊戲 — pure logic + data tables
    // =============================================================
    //
    // DOM-free: round construction and the memory-time option tables.

    var STANDARD_MEMORY_OPTIONS = [
        ['5', '5 秒'],
        ['10', '10 秒'],
        ['15', '15 秒'],
        ['20', '20 秒'],
        ['manual', '手動']
    ];
    var ORDER_MEMORY_OPTIONS = [
        ['1', '1 秒'],
        ['3', '3 秒'],
        ['5', '5 秒'],
        ['manual', '手動']
    ];

    function buildShoppingRound(listCount, choiceCount, foodData, shuffle, getFoodId) {
        var shuffled = shuffle(foodData);
        var list = [];
        var seenNames = new Set();
        for (var i = 0; i < shuffled.length; i++) {
            var item = shuffled[i];
            if (list.length >= listCount) break;
            if (seenNames.has(item.name)) continue;
            seenNames.add(item.name);
            list.push(item);
        }
        var listIds = new Set(list.map(function (item) { return getFoodId(item); }));
        var distractors = shuffle(foodData.filter(function (item) {
            return !listIds.has(getFoodId(item)) && !seenNames.has(item.name);
        })).slice(0, choiceCount - listCount);
        var gridItems = shuffle([
            ...list.map(function (item) { return { ...item, isTarget: true }; }),
            ...distractors.map(function (item) { return { ...item, isTarget: false }; })
        ]);
        return { list: list, gridItems: gridItems };
    }

    var api = {
        STANDARD_MEMORY_OPTIONS: STANDARD_MEMORY_OPTIONS,
        ORDER_MEMORY_OPTIONS: ORDER_MEMORY_OPTIONS,
        buildShoppingRound: buildShoppingRound
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveShoppingLogic = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);