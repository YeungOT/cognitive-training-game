(function (global) {
    'use strict';

    function createStroopScreenDefinition() {
        return {
            game: {
                topBar: {
                    backId: 'stroopBackBtn',
                    titleId: 'stroopRuleText',
                    titleChildren: [
                        { text: '睇 ' },
                        { id: 'stroopModeLabel', className: 'stroop-mode-label', text: '表情' }
                    ],
                    scoreId: 'stroopScoreNum',
                    hamburgerId: 'hamburgerBtnStroop'
                },
                stage: {
                    id: 'stroopStage',
                    className: 'stroop-stage',
                    children: [
                        {
                            tagName: 'div',
                            id: 'stroopFaceWrap',
                            className: 'stroop-face-wrap',
                            children: [
                                {
                                    tagName: 'img',
                                    id: 'stroopFace',
                                    className: 'stroop-face',
                                    attributes: { alt: '' }
                                },
                                {
                                    tagName: 'div',
                                    id: 'stroopWord',
                                    className: 'stroop-word',
                                    text: ''
                                }
                            ]
                        },
                        {
                            tagName: 'div',
                            id: 'stroopPhaseHint',
                            className: 'stroop-phase-hint hidden',
                            text: ''
                        }
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
                                        {
                                            tagName: 'button',
                                            id: 'stroopSpeedDown',
                                            className: 'speed-btn',
                                            title: '減慢速度',
                                            children: [
                                                { tagName: 'svg', attributes: { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, children: [
                                                    { tagName: 'path', attributes: { d: 'M5 12h14' } }
                                                ] }
                                            ]
                                        },
                                        { tagName: 'span', id: 'stroopSpeedDisplay', className: 'speed-display', text: '5' },
                                        {
                                            tagName: 'button',
                                            id: 'stroopSpeedUp',
                                            className: 'speed-btn',
                                            title: '加快速度',
                                            children: [
                                                { tagName: 'svg', attributes: { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, children: [
                                                    { tagName: 'path', attributes: { d: 'M12 5v14M5 12h14' } }
                                                ] }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    tagName: 'button',
                                    id: 'stroopPlayBtn',
                                    className: 'play-btn',
                                    title: '播放/暫停',
                                    children: [
                                        { tagName: 'span', className: 'play-icon', children: [
                                            { tagName: 'span', className: 'triangle' },
                                            { tagName: 'span', className: 'pause-bar left' },
                                            { tagName: 'span', className: 'pause-bar right' }
                                        ] }
                                    ]
                                }
                            ]
                        },
                        className: 'center-group stroop-controls',
                        children: [
                            { tagName: 'button', id: 'stroopPositiveBtn', className: 'stroop-answer-btn stroop-positive', text: '開心' },
                            { tagName: 'button', id: 'stroopNegativeBtn', className: 'stroop-answer-btn stroop-negative', text: '唔開心' }
                        ]
                    }
                }
            }
        };
    }

    var api = { createStroopScreenDefinition: createStroopScreenDefinition };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveStroopScreen = api;
    if (typeof global !== 'undefined' && typeof window === 'undefined') global.CognitiveStroopScreen = api;
})(typeof window !== 'undefined' ? window : globalThis);
