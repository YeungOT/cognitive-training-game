(function (global) {
    'use strict';

    // Direct DOM adapter for the Stroop screen. No game state or timing here;
    // the game module injects the trial and reads the collected elements.

    function createStroopEls(doc) {
        function byId(id) { return doc.getElementById(id); }
        return {
            stage: byId('stroopStage'),
            faceWrap: byId('stroopFaceWrap'),
            face: byId('stroopFace'),
            word: byId('stroopWord'),
            phaseHint: byId('stroopPhaseHint'),
            scoreNum: byId('stroopScoreNum'),
            ruleText: byId('stroopRuleText'),
            modeLabel: byId('stroopModeLabel'),
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
        els.stage.dataset.phase = trial.phase;
        els.stage.classList.remove('stroop-empty');
        var practice = trial.phase === 'practice';
        els.phaseHint.textContent = practice ? '練習' : '';
        els.phaseHint.classList.toggle('hidden', !practice);
    }

    function clearStroopStage(els) {
        if (!els) return;
        els.face.removeAttribute('src');
        els.face.alt = '';
        els.word.textContent = '';
        els.phaseHint.textContent = '';
        els.phaseHint.classList.add('hidden');
        els.stage.classList.add('stroop-empty');
        els.stage.removeAttribute('data-condition');
        els.stage.removeAttribute('data-phase');
    }

    function setScore(els, score) {
        if (els && els.scoreNum) els.scoreNum.textContent = String(score);
    }

    function setRuleText(els, mode) {
        if (!els || !els.modeLabel) return;
        els.modeLabel.textContent = mode === 'word' ? '文字' : '表情';
        if (els.ruleText) els.ruleText.dataset.mode = mode;
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

    function showIntro(message, mode) {
        if (!message) return;
        var faceMode = mode === 'face';
        message.show({
            icon: '🎭',
            title: faceMode ? '睇表情，答開心定唔開心' : '睇文字，答開心定唔開心',
            subtitle: faceMode ? '唔好理個字。6次練習之後開始計分。' : '唔好理個表情。6次練習之後開始計分。',
            buttons: [{ text: '開始', className: 'btn-stay' }],
            pauseTimer: true
        });
    }

    function showModeSwitch(message, mode, onSelect) {
        if (!message) return;
        message.show({
            title: '🔄 切換玩法',
            subtitle: '切換後會由頭開始這一回',
            buttons: [
                { text: (mode === 'face' ? '✅ ' : '') + '睇表情', className: 'btn-stay', action: function () { onSelect('face'); } },
                { text: (mode === 'word' ? '✅ ' : '') + '睇文字', className: 'btn-stay', action: function () { onSelect('word'); } }
            ],
            pauseTimer: false
        });
    }

    var api = {
        createStroopEls: createStroopEls,
        renderStroopTrial: renderStroopTrial,
        clearStroopStage: clearStroopStage,
        setScore: setScore,
        setRuleText: setRuleText,
        setSpeed: setSpeed,
        syncPlayButton: syncPlayButton,
        flashStage: flashStage,
        clearFlash: clearFlash,
        showIntro: showIntro,
        showModeSwitch: showModeSwitch
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.CognitiveStroopView = api;
    if (typeof global !== 'undefined' && typeof window === 'undefined') global.CognitiveStroopView = api;
})(typeof window !== 'undefined' ? window : globalThis);
