(function (global) {
    'use strict';

    // Screen definition for the Palm (手勢) game, composed by the shared
    // Game Screen so it matches the other migrated games. Mirrors the previous
    // static markup in index.html exactly: no score, no title text and no
    // separator in the top bar, since Palm never had them.
    function createPalmScreenDefinition() {
        return {
            game: {
                topBar: {
                    backId: 'palmBackBtn',
                    hamburgerId: 'palmMenuBtn',
                    separator: false,
                    dropdowns: [
                        {
                            selectId: 'difficultySelect',
                            label: '手勢',
                            options: [
                                { value: 'easy', label: '包剪揼' },
                                { value: 'hard', label: '全部', selected: true }
                            ]
                        },
                        {
                            selectId: 'handSelect',
                            label: '正反手',
                            options: [
                                { value: 'both', label: '正反手', selected: true },
                                { value: 'palmar', label: '正手' }
                            ]
                        }
                    ]
                },
                stage: {
                    id: 'palmGrid',
                    className: 'grid-wrapper',
                    child: {
                        className: 'game-board',
                        children: [
                            {
                                tagName: 'div', className: 'side', id: 'leftSide',
                                children: [
                                    { tagName: 'div', id: 'leftGesture', className: 'gesture-image' }
                                ]
                            },
                            {
                                tagName: 'div', className: 'side', id: 'rightSide',
                                children: [
                                    { tagName: 'div', id: 'rightGesture', className: 'gesture-image' }
                                ]
                            }
                        ]
                    }
                },
                footer: {
                    className: 'bottom-controls',
                    controls: {
                        left: {
                            children: [
                                {
                                    tagName: 'div', className: 'speed-control',
                                    children: [
                                        {
                                            tagName: 'button', id: 'speedDown', className: 'speed-btn',
                                            title: '減慢速度', attributes: { 'aria-label': '減慢速度' },
                                            children: [
                                                {
                                                    tagName: 'svg',
                                                    attributes: { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
                                                    children: [
                                                        { tagName: 'path', attributes: { d: 'M5 12h14' } }
                                                    ]
                                                }
                                            ]
                                        },
                                        { tagName: 'span', id: 'speedDisplay', className: 'speed-display', text: '5' },
                                        {
                                            tagName: 'button', id: 'speedUp', className: 'speed-btn',
                                            title: '加快速度', attributes: { 'aria-label': '加快速度' },
                                            children: [
                                                {
                                                    tagName: 'svg',
                                                    attributes: { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
                                                    children: [
                                                        { tagName: 'path', attributes: { d: 'M12 5v14M5 12h14' } }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    tagName: 'button', id: 'playBtn', className: 'play-btn', title: '自動播放',
                                    children: [
                                        {
                                            tagName: 'span', className: 'play-icon',
                                            children: [
                                                { tagName: 'span', className: 'triangle' },
                                                { tagName: 'span', className: 'pause-bar left' },
                                                { tagName: 'span', className: 'pause-bar right' }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        className: 'center-group palm-controls',
                        children: [
                            {
                                tagName: 'button', id: 'swapBtn', title: '交換左右手勢',
                                children: [
                                    { tagName: 'span', id: 'swapSymbol', text: '交換' }
                                ]
                            }
                        ]
                    }
                }
            }
        };
    }

    var api = { createPalmScreenDefinition: createPalmScreenDefinition };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitivePalmScreen = api;
})(typeof window !== 'undefined' ? window : globalThis);
