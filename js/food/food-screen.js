(function (global) {
    'use strict';

    function option(value, label, selected) {
        return { value, label, selected: !!selected };
    }

    function field(id, label, values, labels, selectedIndex) {
        return {
            id,
            label,
            options: values.map((value, index) => option(value, labels[index], index === selectedIndex))
        };
    }

    // Food has one screen, so it only consumes the shared game chrome.
    function createFoodScreenDefinition() {
        return {
            game: {
                topBar: {
                    backId: 'foodBackBtn',
                    titleId: 'questionText',
                    title: '❓ 選擇食物',
                    scoreId: 'foodScoreNum',
                    dropdown: {
                selectId: 'countSelect',
                label: '顯示',
                options: [option('2', '2'), option('3', '3', true), option('4', '4')]
            },
                    actions: [{
                        id: 'toggleNamesBtn',
                        title: '顯示/隱藏食物名稱',
                        text: '名稱',
                        badgeId: 'nameBadge',
                        badgeClassName: 'state-badge on'
                    }],
                    hamburgerId: 'hamburgerBtnFood'
                },
                stage: {
                    id: 'foodGridWrapper',
                    className: 'grid-wrapper',
                    child: { id: 'gridContainer', className: 'grid-container cols-3' }
                },
                footer: {
                    hint: '💡 點擊圖片選擇答案',
                    roundId: 'foodRoundInfo',
                    roundText: '第 1 題'
                }
            }
        };
    }

    var api = { createFoodScreenDefinition };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveFoodScreen = api;
})(typeof window !== 'undefined' ? window : globalThis);
