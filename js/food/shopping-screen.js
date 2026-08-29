(function (global) {
    'use strict';

    function option(value, label, selected) {
        return { value: value, label: label, selected: !!selected };
    }

    function field(id, label, values, labels, selectedIndex) {
        return {
            id: id,
            label: label,
            options: values.map((value, index) => option(value, labels[index], index === selectedIndex))
        };
    }

    // The screen layout is declarative so Shopping uses the shared Game Screen
    // chrome; only game-specific IDs, labels, and options live here.
    function createShoppingScreenDefinition(logic) {
        const standardTimes = logic.STANDARD_MEMORY_OPTIONS;
        const memoryOptions = standardTimes.map(([value, label], index) =>
            option(value, label, value === 'manual')
        );

        return {
            game: {
                topBar: {
                    backId: 'shoppingBackBtn',
                    titleId: 'shoppingPhaseText',
                    title: '📋 購物清單（3 樣）',
                    scoreId: 'shoppingScoreNum',
                    actions: [{
                        id: 'shoppingNameToggleBtn',
                        title: '顯示/隱藏食物名稱',
                        text: '名稱',
                        badgeId: 'shoppingNameBadge',
                        badgeClassName: 'state-badge on'
                    }],
                    hamburgerId: 'hamburgerBtnShopping'
                },
                stage: {
                    id: 'shoppingStage',
                    className: 'shopping-stage',
                    children: [
                        {
                            id: 'shoppingListView',
                            className: 'shopping-view',
                            children: [{ className: 'shopping-list-panel', children: [
                                { id: 'shoppingListGrid', className: 'shopping-list-grid count-3' },
                                { id: 'shoppingListHint', className: 'shopping-list-hint' }
                            ]}]
                        },
                        {
                            id: 'shoppingRecallView',
                            className: 'shopping-view hidden',
                            children: [{ className: 'shopping-recall-panel', children: [
                                { id: 'shoppingRecallGrid', className: 'shopping-recall-grid count-6' }
                            ]}]
                        },
                        {
                            id: 'shoppingOrderView',
                            className: 'shopping-view hidden',
                            children: [{ className: 'shopping-order-panel', children: [
                                { id: 'shoppingOrderIndicator', className: 'shopping-order-indicator', text: '1' },
                                { id: 'shoppingOrderItem', className: 'shopping-order-item' }
                            ]}]
                        }
                    ]
                },
                footer: {
                    className: 'bottom-controls',
                    controls: {
                        className: 'center-group shopping-controls',
                        children: [
                            { tagName: 'span', id: 'shoppingProgress', className: 'shopping-progress hidden', text: '已揀選 0 / 3' },
                            { tagName: 'span', id: 'shoppingTimer', className: 'shopping-timer', text: '--' },
                            { tagName: 'button', id: 'shoppingManualStartBtn', className: 'shopping-primary-btn hidden', text: '▶ 開始揀選' }
                        ]
                    }
                }
            },
            settings: {
                id: 'shoppingSettings',
                backId: 'shoppingSettingsBackBtn',
                title: '🛒 設定',
                subtitle: '設定購物清單與回憶任務',
                chromeRightCluster: true,
                saveButton: {
                    id: 'shoppingSaveSettingsBtn',
                    label: '💾儲存',
                    title: '儲存設定'
                },
                hamburgerId: 'hamburgerBtnShoppingSettings',
                fields: [
                    field('shoppingListDisplayMode', '📋 清單顯示', ['image', 'name'], ['圖片', '名稱'], 0),
                    field('shoppingListCount', '🔢 清單數量', ['2', '3', '4', '5'], ['2', '3', '4', '5'], 1),
                    {
                        id: 'shoppingMemoryTime',
                        options: memoryOptions,
                        labelNode: {
                            tagName: 'span',
                            className: 'game-screen-label shopping-memory-time-label',
                            children: [
                                { tagName: 'span', className: 'shopping-memory-time-base', text: '⏳ 記憶時間' },
                                { tagName: 'span', id: 'shoppingMemoryTimeSuffix', className: 'shopping-memory-time-suffix', text: '（每張）' },
                                { tagName: 'span', id: 'shoppingOrderLightbulb', className: 'shopping-order-lightbulb hidden', title: '選擇已變更', text: '💡' }
                            ]
                        }
                    },
                    field('shoppingChoiceCount', '🧩 選擇數量', ['4', '6', '8'], ['4', '6', '8'], 1),
                    { separator: true },
                    field('shoppingOrderRequired', '🔢 順序要求', ['false', 'true'], ['不需順序', '需要順序'], 0),
                    field('shoppingRecallTime', '⏳ 揀選時間', ['0', '15', '30', '45', '60'], ['不限時', '15 秒', '30 秒', '45 秒', '60 秒'], 0)
                ],
                action: { id: 'shoppingStartBtn', label: '▶ 開始遊戲' }
            }
        };
    }

    var api = { createShoppingScreenDefinition: createShoppingScreenDefinition };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveShoppingScreen = api;
})(typeof window !== 'undefined' ? window : globalThis);
