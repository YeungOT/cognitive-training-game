(function (global) {
    'use strict';

    function option(value, label, selected) {
        return { value: value, label: label, selected: !!selected };
    }

    function field(id, label, values, labels, selectedIndex) {
        return {
            id: id,
            label: label,
            options: values.map(function (value, index) {
                return option(value, labels[index], index === selectedIndex);
            })
        };
    }

    var CATEGORY_OPTIONS = [
        ['全部', '其他'],
        ['水果', '水果'],
        ['蔬菜', '蔬菜'],
        ['肉類', '肉類'],
        ['點心', '點心'],
        ['堅果', '堅果'],
        ['甜品', '甜品'],
        ['海鮮', '海鮮']
    ].map(function (pair) { return option(pair[0], pair[1]); });

    function createGngScreenDefinition() {
        return {
            game: {
                topBar: {
                    backId: 'gngBackBtn',
                    titleId: 'gngRuleText',
                    titleChildren: [
                        { text: '✅ ' },
                        { id: 'gngGoLabel', className: 'go-highlight', text: '水果' },
                        { text: ' → ❌ ' },
                        { id: 'gngNoGoLabel', className: 'nogo-highlight', text: '蔬菜' }
                    ],
                    scoreId: 'gngScoreNum',
                    hamburgerId: 'hamburgerBtnGng'
                },
                stage: {
                    id: 'gngGridWrapper',
                    className: 'gng-grid-wrapper',
                    child: { id: 'gngGridContainer', className: 'gng-grid-container cols-1' }
                },
                footer: {
                    className: 'bottom-controls',
                    controls: {
                        left: {
                            className: 'left-group',
                            children: [
                                {
                                    tagName: 'div',
                                    className: 'speed-control',
                                    children: [
                                        { tagName: 'button', id: 'gngSpeedDown', className: 'speed-btn', title: '減慢速度', text: '−' },
                                        { tagName: 'span', id: 'gngSpeedDisplay', className: 'speed-display', text: '5' },
                                        { tagName: 'button', id: 'gngSpeedUp', className: 'speed-btn', title: '加快速度', text: '+' }
                                    ]
                                },
                                { tagName: 'button', id: 'gngPlayBtn', className: 'play-btn', title: '播放/暫停', children: [
                                    { tagName: 'span', className: 'play-icon', children: [
                                        { tagName: 'span', className: 'triangle' },
                                        { tagName: 'span', className: 'pause-bar left' },
                                        { tagName: 'span', className: 'pause-bar right' }
                                    ] }
                                ] }
                            ]
                        },
                        className: 'center-group gng-controls',
                        children: [
                            { tagName: 'button', id: 'gngGoBtn', className: 'go-btn', text: '✅' },
                            { tagName: 'button', id: 'gngNoGoBtn', className: 'nogo-btn', text: '❌' }
                        ]
                    }
                }
            },
            settings: {
                id: 'gngSettings',
                backId: 'gngSettingsBackBtn',
                title: '⚙️ 設定',
                chromeRightCluster: true,
                saveButton: { id: 'gngSaveSettingsBtn', label: '💾儲存', title: '儲存設定' },
                hamburgerId: 'hamburgerBtnGngSettings',
                fields: [
                    { id: 'gngGoCategory', label: '✅ Go 類別', options: CATEGORY_OPTIONS },
                    { id: 'gngNoGoCategory', label: '❌ No Go 類別', options: CATEGORY_OPTIONS },
                    { separator: true },
                    { label: '🔄 自動切換', button: { id: 'gngAutoToggle', text: '關閉' } },
                    field('gngSwitchType', '切換類型', ['random', 'swap'], ['隨機變更兩者', '互換'], 1),
                    field('gngSwitchFreq', '切換頻率', ['5', '10', '15', '20'], ['5 張', '10 張', '15 張', '20 張'], 1)
                ],
                action: { id: 'gngStartBtn', label: '▶ 開始遊戲' }
            }
        };
    }

    var api = { createGngScreenDefinition: createGngScreenDefinition };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveGngScreen = api;
})(typeof window !== 'undefined' ? window : globalThis);
