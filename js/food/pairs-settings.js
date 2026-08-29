(function (global) {
    'use strict';

    const PREVIEW_TIMES = ['5', '10', '15', '20', 'manual'];

    function loadPairsPreferences(prefs) {
        const stored = prefs ? prefs.load('cognitivePairsPrefs') : null;
        const pairCount = stored && stored.pairCount >= 3 && stored.pairCount <= 5
            ? stored.pairCount
            : 4;
        const previewTime = stored && PREVIEW_TIMES.indexOf(stored.previewTime) !== -1
            ? stored.previewTime
            : 'manual';
        return { pairCount: pairCount, previewTime: previewTime };
    }

    function bindPairsSettings(els, prefs, listenOpts, handlers) {
        handlers = handlers || {};
        if (els.settingsBackBtn) {
            els.settingsBackBtn.addEventListener('click', function () {
                if (handlers.onBack) handlers.onBack();
            }, listenOpts);
        }
        if (els.startBtn) {
            els.startBtn.addEventListener('click', function () {
                if (handlers.onStart) handlers.onStart();
            }, listenOpts);
        }
        if (els.pairCountSelect) {
            els.pairCountSelect.addEventListener('change', function () {
                const count = parseInt(this.value, 10);
                if (count >= 3 && count <= 5) {
                    if (prefs) prefs.save('cognitivePairsPrefs', { pairCount: count });
                    if (handlers.onPairCountChange) handlers.onPairCountChange(count);
                }
            }, listenOpts);
        }
        if (els.previewTimeSelect) {
            els.previewTimeSelect.addEventListener('change', function () {
                const value = this.value;
                if (PREVIEW_TIMES.indexOf(value) !== -1) {
                    if (prefs) prefs.save('cognitivePairsPrefs', { previewTime: value });
                    if (handlers.onPreviewTimeChange) handlers.onPreviewTimeChange(value);
                }
            }, listenOpts);
        }
    }

    function bindPairsControls(els, listenOpts, handlers) {
        handlers = handlers || {};
        if (els.settingsBackBtn) {
            els.settingsBackBtn.addEventListener('click', function () {
                if (handlers.onSettingsBack) handlers.onSettingsBack();
            }, listenOpts);
        }
        if (els.startBtn) {
            els.startBtn.addEventListener('click', function () {
                if (handlers.onStart) handlers.onStart();
            }, listenOpts);
        }
        if (els.backBtn) {
            els.backBtn.addEventListener('click', function () {
                if (handlers.onGameBack) handlers.onGameBack();
            }, listenOpts);
        }
        if (els.manualStartBtn) {
            els.manualStartBtn.addEventListener('click', function () {
                if (handlers.onManualStart) handlers.onManualStart();
            }, listenOpts);
        }
        if (els.pairCountSelect) {
            els.pairCountSelect.addEventListener('change', function () {
                const count = parseInt(this.value, 10);
                if (count >= 3 && count <= 5) {
                    if (handlers.onPairCountChange) handlers.onPairCountChange(count);
                }
            }, listenOpts);
        }
        if (els.previewTimeSelect) {
            els.previewTimeSelect.addEventListener('change', function () {
                const value = this.value;
                if (PREVIEW_TIMES.indexOf(value) !== -1) {
                    if (handlers.onPreviewTimeChange) handlers.onPreviewTimeChange(value);
                }
            }, listenOpts);
        }
    }


    function createPairsScreenDefinition() {
        return {
            game: {
                topBar: {
                    backId: 'pairsBackBtn',
                    titleId: 'pairsQuestionText',
                    title: '🃏 配對記憶',
                    scoreId: 'pairsScoreNum',
                    hamburgerId: 'hamburgerBtnPairs'
                },
                stage: {
                    id: 'pairsGridWrapper',
                    className: 'dual-stage',
                    child: { id: 'pairsGridContainer', className: 'dual-grid' }
                },
                footer: {
                    hint: '🃏 翻開兩張卡片，找出相同食物',
                    roundId: 'pairsRoundInfo',
                    roundText: '第 1 局'
                }
            },
            settings: {
                id: 'pairsSettings',
                backId: 'pairsSettingsBackBtn',
                title: '🃏 配對記憶',
                subtitle: '選擇對數',
                hamburgerId: 'hamburgerBtnPairsSettings',
                fields: [
                    {
                        id: 'pairsCountSelect',
                        label: '🔢 對數',
                        options: [
                            { value: '3', label: '3' },
                            { value: '4', label: '4', selected: true },
                            { value: '5', label: '5' }
                        ]
                    },
                    {
                        id: 'pairsPreviewTimeSelect',
                        label: '⏳ 預覽時間',
                        options: [
                            { value: '5', label: '5 秒' },
                            { value: '10', label: '10 秒' },
                            { value: '15', label: '15 秒' },
                            { value: '20', label: '20 秒' },
                            { value: 'manual', label: '手動', selected: true }
                        ]
                    }
                ],
                action: { id: 'pairsStartBtn', label: '▶ 開始遊戲' }
            }
        };
    }

    var api = {
        PREVIEW_TIMES: PREVIEW_TIMES,
        loadPairsPreferences: loadPairsPreferences,
        createPairsScreenDefinition: createPairsScreenDefinition,
        bindPairsSettings: bindPairsSettings,
        bindPairsControls: bindPairsControls
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.CognitivePairsSettings = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
