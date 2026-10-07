(function (global) {
    'use strict';

    // =============================================================
    // 雙重 N-back — view (UI layer)
    // =============================================================
    //
    // Owns every direct DOM interaction of the dual N-back screen: element
    // lookup, grid/card rendering, match-button + settings UI, feedback
    // flash, instruction popup, and control binding. No game state or
    // business logic - callbacks are injected.

    var dualFeedbackTimer = null;
    var FLASH_MS = 600;

    function createDualNbackEls(doc) {
        var $ = function (id) { return doc.getElementById(id); };
        return {
            game: $('dualNbackGame'),
            settings: $('dualNbackSettings'),
            modeSelect: $('nbackModeSelect'),
            stage: $('dualNbackStage'),
            grid: $('dualNbackGrid'),
            card: $('dualNbackCard'),
            image: $('dualNbackImage'),
            scoreNum: $('dualNbackScoreNum'),
            playBtn: $('dualNbackPlayBtn'),
            speedDisplay: $('dualNbackSpeedDisplay'),
            speedDown: $('dualNbackSpeedDown'),
            speedUp: $('dualNbackSpeedUp'),
            nSelect: $('dualNbackNSelect'),
            matchButtons: $('dualNbackMatchButtons'),
            backBtn: $('dualNbackBackBtn'),
            settingsBackBtn: $('dualNbackSettingsBackBtn'),
            modeBackBtn: $('nbackModeBackBtn'),
            singleBtn: $('singleNbackBtn'),
            dualBtn: $('dualNbackBtn'),
            modality1Select: $('dualModality1Select'),
            modality2Select: $('dualModality2Select'),
            positionSettings: $('dualPositionSettings'),
            positionGridSelect: $('dualPositionGridSelect'),
            colorSettings: $('dualColorSettings'),
            colorPaletteSelect: $('dualColorPaletteSelect'),
            startBtn: $('dualStartBtn')
        };
    }

    function getDualVisibleContent(els, modalities) {
        return modalities.indexOf('position') !== -1 ? els.grid : els.card;
    }

    function renderDualGrid(doc, els, opts) {
        opts = opts || {};
        const gridInfo = opts.positionGrids[opts.positionGrid] || opts.positionGrids['3x3'];
        const hasImage = opts.modalities.indexOf('image') !== -1;
        const hasFace = opts.modalities.indexOf('identity') !== -1 || opts.modalities.indexOf('expression') !== -1;
        const hasColor = opts.modalities.indexOf('color') !== -1;
        const position = opts.currentItems.position || 0;
        const imageItem = opts.currentItems.image || opts.currentItems.identity || opts.currentItems.expression;
        const colorItem = opts.currentItems.color;

        els.grid.className = `dual-grid dual-grid-${opts.positionGrid}`;
        els.grid.style.setProperty('--grid-cols', gridInfo.cols);
        els.grid.style.setProperty('--grid-rows', gridInfo.rows);
        els.grid.innerHTML = '';

        for (let i = 0; i < gridInfo.cols * gridInfo.rows; i++) {
            const cell = doc.createElement('div');
            cell.className = 'dual-grid-cell' + (i === position ? ' active' : '');
            if (i === position && (hasImage || hasFace) && imageItem) {
                const img = doc.createElement('img');
                img.src = imageItem.image;
                img.alt = imageItem.name;
                img.setAttribute('aria-label', imageItem.name);
                cell.appendChild(img);
            } else if (i === position && hasColor && colorItem) {
                cell.classList.add('color-cell');
                cell.style.background = colorItem.css;
            } else if (i === position) {
                cell.classList.add('position-only');
            }
            els.grid.appendChild(cell);
        }
    }

    function renderDualCard(doc, els, opts) {
        opts = opts || {};
        const hasImage = opts.modalities.indexOf('image') !== -1;
        const hasFace = opts.modalities.indexOf('identity') !== -1 || opts.modalities.indexOf('expression') !== -1;
        const hasColor = opts.modalities.indexOf('color') !== -1;
        const imageItem = opts.currentItems.image || opts.currentItems.identity || opts.currentItems.expression;
        const colorItem = opts.currentItems.color;

        els.card.classList.toggle('color-card', hasColor);
        els.card.style.background = hasColor && colorItem ? colorItem.css : '';
        if ((hasImage || hasFace) && imageItem) {
            els.image.style.display = 'block';
            els.image.src = imageItem.image;
            els.image.alt = imageItem.name;
            els.image.setAttribute('aria-label', imageItem.name);
        } else {
            els.image.style.display = 'none';
            els.image.removeAttribute('src');
            els.image.alt = '';
        }
    }
    // 回饋燈光: correct/wrong class on the visible active cell(s) or card.
    function flashDualFeedback(els, visible, correct) {
        const targets = visible === els.grid
            ? Array.from(visible.querySelectorAll('.dual-grid-cell.active'))
            : [visible];
        clearTimeout(dualFeedbackTimer);
        targets.forEach(function (target) {
            target.classList.remove('feedback-correct', 'feedback-wrong');
        });
        targets.forEach(function (target) {
            target.classList.add(correct ? 'feedback-correct' : 'feedback-wrong');
        });
        dualFeedbackTimer = setTimeout(function () {
            targets.forEach(function (target) {
                target.classList.remove('feedback-correct', 'feedback-wrong');
            });
        }, FLASH_MS);
    }

    function buildDualMatchButtons(doc, els, modalities, labels, onMatch) {
        els.matchButtons.innerHTML = '';
        modalities.forEach(modality => {
            const btn = doc.createElement('button');
            btn.className = 'dual-match-btn';
            btn.dataset.modality = modality;
            btn.textContent = labels[modality];
            btn.addEventListener('click', function () {
                if (onMatch) onMatch(modality);
            });
            els.matchButtons.appendChild(btn);
        });
    }

    // Settings panel: toggles the position/color option groups and enables the
    // start button when the two modalities are valid.
    function updateDualSettingsState(els) {
        const modality1 = els.modality1Select.value;
        const modality2 = els.modality2Select.value;
        const needsPosition = modality1 === 'position' || modality2 === 'position';
        const needsColor = modality1 === 'color' || modality2 === 'color';
        const hasIdentity = modality1 === 'identity' || modality2 === 'identity';
        const hasExpression = modality1 === 'expression' || modality2 === 'expression';
        const hasAudio = modality1 === 'audio' || modality2 === 'audio';
        const facePair = hasIdentity || hasExpression;
        const validFacePair = !facePair || (
            hasIdentity && hasExpression && !needsPosition && !needsColor && !hasAudio
        );

        els.positionSettings.classList.toggle('hidden', !needsPosition);
        els.colorSettings.classList.toggle('hidden', !needsColor);

        if (needsPosition && !els.positionGridSelect.value) els.positionGridSelect.value = '3x3';
        if (needsColor && !els.colorPaletteSelect.value) els.colorPaletteSelect.value = '6';

        const valid = Boolean(modality1 && modality2 && modality1 !== modality2 &&
            validFacePair &&
            (!needsPosition || els.positionGridSelect.value) &&
            (!needsColor || els.colorPaletteSelect.value));
        els.startBtn.disabled = !valid;
        els.startBtn.style.opacity = valid ? '1' : '0.45';
    }

    function showInstruction(message, modalities, labels, n) {
        const labelNames = modalities.map(modality => labels[modality]);
        message.show({
            title: `看看${labelNames.join('和')}與上 ${n} 張是否相同`,
            subtitle: '',
            extraLarge: true,
            pauseTimer: false
        });
    }

    function setScore(scoreNum, score) {
        scoreNum.textContent = score;
    }

    function bindDualControls(els, keyboard, listenOpts, handlers) {
        handlers = handlers || {};
        if (els.playBtn) {
            els.playBtn.addEventListener('click', function () { if (handlers.onPlayPause) handlers.onPlayPause(); }, listenOpts);
        }
        if (els.card) {
            els.card.addEventListener('click', function () { if (handlers.onAdvance) handlers.onAdvance(); }, listenOpts);
        }
        if (els.grid) {
            els.grid.addEventListener('click', function () { if (handlers.onAdvance) handlers.onAdvance(); }, listenOpts);
        }
        if (els.speedDown) {
            els.speedDown.addEventListener('click', function () { if (handlers.onSpeedDown) handlers.onSpeedDown(); }, listenOpts);
        }
        if (els.speedUp) {
            els.speedUp.addEventListener('click', function () { if (handlers.onSpeedUp) handlers.onSpeedUp(); }, listenOpts);
        }
        if (els.nSelect) {
            els.nSelect.addEventListener('change', function () {
                if (handlers.onNChange) handlers.onNChange(els.nSelect.value);
            }, listenOpts);
        }
        if (els.backBtn) {
            els.backBtn.addEventListener('click', function () { if (handlers.onBack) handlers.onBack(); }, listenOpts);
        }
        if (els.settingsBackBtn) {
            els.settingsBackBtn.addEventListener('click', function () { if (handlers.onSettingsBack) handlers.onSettingsBack(); }, listenOpts);
        }
        if (els.modeBackBtn) {
            els.modeBackBtn.addEventListener('click', function () { if (handlers.onModeBack) handlers.onModeBack(); }, listenOpts);
        }
        if (els.singleBtn) {
            els.singleBtn.addEventListener('click', function () { if (handlers.onSingle) handlers.onSingle(); }, listenOpts);
        }
        if (els.dualBtn) {
            els.dualBtn.addEventListener('click', function () { if (handlers.onDual) handlers.onDual(); }, listenOpts);
        }
        if (els.modality1Select) {
            els.modality1Select.addEventListener('change', function () { if (handlers.onSettingsChange) handlers.onSettingsChange(); }, listenOpts);
        }
        if (els.modality2Select) {
            els.modality2Select.addEventListener('change', function () { if (handlers.onSettingsChange) handlers.onSettingsChange(); }, listenOpts);
        }
        if (els.positionGridSelect) {
            els.positionGridSelect.addEventListener('change', function () { if (handlers.onSettingsChange) handlers.onSettingsChange(); }, listenOpts);
        }
        if (els.colorPaletteSelect) {
            els.colorPaletteSelect.addEventListener('change', function () { if (handlers.onSettingsChange) handlers.onSettingsChange(); }, listenOpts);
        }
        if (els.startBtn) {
            els.startBtn.addEventListener('click', function () { if (handlers.onStart) handlers.onStart(); }, listenOpts);
        }
        if (keyboard) {
            keyboard.registerScreen('dualNbackGame', handlers.keyboard || {});
        }
    }

    var api = {
        createDualNbackEls: createDualNbackEls,
        getDualVisibleContent: getDualVisibleContent,
        renderDualGrid: renderDualGrid,
        renderDualCard: renderDualCard,
        flashDualFeedback: flashDualFeedback,
        buildDualMatchButtons: buildDualMatchButtons,
        updateDualSettingsState: updateDualSettingsState,
        showInstruction: showInstruction,
        setScore: setScore,
        bindDualControls: bindDualControls
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveDualNbackView = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
