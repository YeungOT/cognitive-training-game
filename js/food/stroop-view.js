(function (global) {
    'use strict';

    // Direct DOM adapter for the Stroop game and settings screens. No game
    // state or timing here; the game module injects the trial and reads the
    // collected elements.

    function createStroopEls(doc) {
        function byId(id) { return doc.getElementById(id); }
        return {
            stage: byId('stroopStage'),
            faceWrap: byId('stroopFaceWrap'),
            face: byId('stroopFace'),
            word: byId('stroopWord'),
            scoreNum: byId('stroopScoreNum'),
            playBtn: byId('stroopPlayBtn'),
            speedDisplay: byId('stroopSpeedDisplay'),
            speedDown: byId('stroopSpeedDown'),
            speedUp: byId('stroopSpeedUp'),
            positiveBtn: byId('stroopPositiveBtn'),
            negativeBtn: byId('stroopNegativeBtn'),
            backBtn: byId('stroopBackBtn')
        };
    }

    function renderStroopTrial(els, trial) {
        if (!els || !trial) return;
        els.face.src = trial.face.src;
        els.face.alt = trial.face.expressionLabel;
        els.word.textContent = trial.word.label;
        els.stage.dataset.condition = trial.condition;
        els.stage.classList.remove('stroop-empty');
    }

    function clearStroopStage(els) {
        if (!els) return;
        els.face.removeAttribute('src');
        els.face.alt = '';
        els.word.textContent = '';
        els.stage.classList.add('stroop-empty');
        els.stage.removeAttribute('data-condition');
    }

    function setScore(els, score) {
        if (els && els.scoreNum) els.scoreNum.textContent = String(score);
    }

    function setSpeed(els, speed) {
        if (els && els.speedDisplay) els.speedDisplay.textContent = String(speed);
    }

    function syncPlayButton(els, playing) {
        if (els && els.playBtn) els.playBtn.classList.toggle('playing', !!playing);
    }

    function flashStage(els, correct) {
        if (!els || !els.faceWrap) return;
        els.faceWrap.classList.remove('feedback-correct', 'feedback-wrong');
        els.faceWrap.classList.add(correct ? 'feedback-correct' : 'feedback-wrong');
    }

    function clearFlash(els) {
        if (els && els.faceWrap) {
            els.faceWrap.classList.remove('feedback-correct', 'feedback-wrong');
        }
    }

    // Same instruction-message shape as Go/No-Go: title only, extra large.
    function showIntro(message) {
        if (!message) return;
        message.show({
            title: '請觀看表情，回答「開心」或「不開心」',
            subtitle: '',
            extraLarge: true,
            pauseTimer: false
        });
    }

    function showRoundComplete(message, score, total, onRestart, onBack) {
        if (!message) return;
        message.show({
            icon: '🏆',
            title: '本回合完成',
            subtitle: '答對 ' + score + ' / ' + total + ' 題',
            buttons: [
                { text: '重新開始', className: 'btn-stay', action: onRestart },
                { text: '返回', className: 'btn-stay', action: onBack }
            ],
            pauseTimer: false
        });
    }

    function bindStroopControls(els, keyboard, listenOpts, handlers) {
        handlers = handlers || {};
        if (els.backBtn) {
            els.backBtn.addEventListener('click', function () { if (handlers.onBack) handlers.onBack(); }, listenOpts);
        }
        if (els.playBtn) {
            els.playBtn.addEventListener('click', function () { if (handlers.onPlayPause) handlers.onPlayPause(); }, listenOpts);
        }
        if (els.speedDown) {
            els.speedDown.addEventListener('click', function () { if (handlers.onSpeed) handlers.onSpeed(-1); }, listenOpts);
        }
        if (els.speedUp) {
            els.speedUp.addEventListener('click', function () { if (handlers.onSpeed) handlers.onSpeed(1); }, listenOpts);
        }
        if (els.positiveBtn) {
            els.positiveBtn.addEventListener('click', function () { if (handlers.onPositive) handlers.onPositive(); }, listenOpts);
        }
        if (els.negativeBtn) {
            els.negativeBtn.addEventListener('click', function () { if (handlers.onNegative) handlers.onNegative(); }, listenOpts);
        }
        if (els.stage) {
            els.stage.addEventListener('click', function () { if (handlers.onAdvance) handlers.onAdvance(); }, listenOpts);
        }
        if (keyboard) {
            keyboard.registerScreen('stroopGame', handlers.keyboard || {});
        }
    }

    var api = {
        createStroopEls: createStroopEls,
        renderStroopTrial: renderStroopTrial,
        clearStroopStage: clearStroopStage,
        setScore: setScore,
        setSpeed: setSpeed,
        syncPlayButton: syncPlayButton,
        flashStage: flashStage,
        clearFlash: clearFlash,
        showIntro: showIntro,
        showRoundComplete: showRoundComplete,
        bindStroopControls: bindStroopControls
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveStroopView = api;
    if (typeof global !== 'undefined' && typeof window === 'undefined') global.CognitiveStroopView = api;
})(typeof window !== 'undefined' ? window : globalThis);
