(function (global) {
    'use strict';

    function option(value, label, selected) {
        return { value: value, label: label, selected: !!selected };
    }

    function field(id, label, options) {
        return { id: id, label: label, options: options };
    }

    var MODALITY_OPTIONS = [
        option('', '請選擇'),
        option('image', '圖片'),
        option('position', '位置'),
        option('color', '顏色'),
        option('audio', '聲音')
    ];

    var POSITION_GRID_OPTIONS = [
        option('', '請選擇'),
        option('2x1', '2 x 1'),
        option('3x1', '3 x 1'),
        option('2x2', '2 x 2'),
        option('3x2', '3 x 2'),
        option('3x3', '3 x 3')
    ];

    var COLOR_PALETTE_OPTIONS = [
        option('6', '6 色', true),
        option('3', '3 色')
    ];

    function createDualNbackScreenDefinition() {
        return {
            game: {
                topBar: {
                    backId: 'dualNbackBackBtn',
                    scoreId: 'dualNbackScoreNum',
                    dropdown: {
                        selectId: 'dualNbackNSelect',
                        ariaLabel: 'N 層級',
                        options: [
                            option('1', 'N=1', true),
                            option('2', 'N=2'),
                            option('3', 'N=3')
                        ]
                    },
                    hamburgerId: 'hamburgerBtnDualNback'
                },
                stage: {
                    id: 'dualNbackStage',
                    className: 'dual-stage',
                    children: [
                        { id: 'dualNbackGrid', className: 'dual-grid hidden' },
                        { tagName: 'div', id: 'dualNbackCard', className: 'dual-card hidden', children: [
                            { tagName: 'img', id: 'dualNbackImage', src: '', alt: '食物' }
                        ] }
                    ]
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
                                        { tagName: 'button', id: 'dualNbackSpeedDown', className: 'speed-btn', title: '減慢速度', text: '−'
                                    },
                                        { tagName: 'span', id: 'dualNbackSpeedDisplay', className: 'speed-display', text: '5' },
                                        { tagName: 'button', id: 'dualNbackSpeedUp', className: 'speed-btn', title: '加快速度', text: '+'
                                    }
                                    ]
                                },
                                { tagName: 'button', id: 'dualNbackPlayBtn', className: 'play-btn', title: '播放/暫停', children: [
                                    { tagName: 'span', className: 'play-icon', children: [
                                        { tagName: 'span', className: 'triangle' },
                                        { tagName: 'span', className: 'pause-bar left' },
                                        { tagName: 'span', className: 'pause-bar right' }
                                    ] }
                                ] }
                            ]
                        },
                        id: 'dualNbackMatchButtons',
                        className: 'center-group dual-match-controls',
                        children: []
                    }
                }
            },
            settings: {
                id: 'dualNbackSettings',
                backId: 'dualNbackSettingsBackBtn',
                title: '⚙️ 設定',
                chromeRightCluster: true,
                hamburgerId: 'hamburgerBtnDualNbackSettings',
                fields: [
                    field('dualModality1Select', '模態一', MODALITY_OPTIONS),
                    field('dualModality2Select', '模態二', MODALITY_OPTIONS),
                    { id: 'dualPositionGridSelect', label: '位置格數', rowId: 'dualPositionSettings', options: POSITION_GRID_OPTIONS },
                    { id: 'dualColorPaletteSelect', label: '顏色組合', rowId: 'dualColorSettings', options: COLOR_PALETTE_OPTIONS }
                ],
                action: { id: 'dualStartBtn', label: '▶ 開始遊戲' }
            }
        };
    }

    var api = { createDualNbackScreenDefinition: createDualNbackScreenDefinition };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveDualNbackScreen = api;
})(typeof window !== 'undefined' ? window : globalThis);
