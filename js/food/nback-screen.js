(function (global) {
    'use strict';

    function option(value, label, selected) {
        return { value: value, label: label, selected: !!selected };
    }

    // Single N-back has no settings screen — only the game chrome.
    function createNbackScreenDefinition() {
        return {
            game: {
                topBar: {
                    backId: 'nbackBackBtn',
                    scoreId: 'nbackScoreNum',
                    dropdown: {
                        selectId: 'nbackNSelect',
                        ariaLabel: 'N 層級',
                        options: [
                            option('1', 'N=1', true),
                            option('2', 'N=2'),
                            option('3', 'N=3')
                        ]
                    },
                    hamburgerId: 'hamburgerBtnNback'
                },
                stage: {
                    id: 'nbackGridWrapper',
                    className: 'grid-wrapper nback-grid-wrapper',
                    child: {
                        tagName: 'div',
                        id: 'nbackImageContainer',
                        className: 'nback-image-container',
                        children: [
                            { tagName: 'img', id: 'nbackImage', src: '', alt: '食物' },
                            { tagName: 'div', id: 'nbackOverlay', className: 'nback-overlay' },
                            { tagName: 'div', id: 'nbackStepLabel', className: 'nback-step-label', text: '#0' },
                            { tagName: 'button', id: 'nbackMagnifyBtn', className: 'magnify-btn nback-magnify-btn', title: '放大圖片', text: '🔍', style: 'display:none;' }
                        ]
                    }
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
                                        { tagName: 'button', id: 'nbackSpeedDown', className: 'speed-btn', title: '減慢速度', children: [
                                            { tagName: 'svg', attributes: { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, children: [
                                                { tagName: 'path', attributes: { d: 'M5 12h14' } }
                                            ] }
                                        ] },
                                        { tagName: 'span', id: 'nbackSpeedDisplay', className: 'speed-display', text: '5' },
                                        { tagName: 'button', id: 'nbackSpeedUp', className: 'speed-btn', title: '加快速度', children: [
                                            { tagName: 'svg', attributes: { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, children: [
                                                { tagName: 'path', attributes: { d: 'M12 5v14M5 12h14' } }
                                            ] }
                                        ] }
                                    ]
                                },
                                { tagName: 'button', id: 'nbackPlayBtn', className: 'play-btn', title: '播放/暫停', children: [
                                    { tagName: 'span', className: 'play-icon', children: [
                                        { tagName: 'span', className: 'triangle' },
                                        { tagName: 'span', className: 'pause-bar left' },
                                        { tagName: 'span', className: 'pause-bar right' }
                                    ] }
                                ] }
                            ]
                        },
                        className: 'center-group nback-controls',
                        children: [
                            { tagName: 'button', id: 'nbackMatchBtn', className: 'match-btn', text: '✅ 相同' },
                            { tagName: 'button', id: 'nbackNotMatchBtn', className: 'notmatch-btn', text: '❌ 不相同' }
                        ]
                    }
                }
            }
        };
    }

    var api = { createNbackScreenDefinition: createNbackScreenDefinition };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveNbackScreen = api;
})(typeof window !== 'undefined' ? window : globalThis);
