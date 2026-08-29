(function (global) {
    'use strict';

    // =============================================================
    // Go/No Go — view (UI layer)
    // =============================================================
    //
    // Owns every direct DOM interaction of the GNG screen: element lookup,
    // image grid render, feedback flash, score/labels/settings display, and
    // control binding. No game state or business logic - callbacks injected.

    var gngCardsTimer = null;

    function createGngEls(doc) {
        var $ = function (id) { return doc.getElementById(id); };
        return {
            gridContainer: $('gngGridContainer'),
            gridWrapper: $('gngGridWrapper'),
            scoreNum: $('gngScoreNum'),
            goLabel: $('gngGoLabel'),
            noGoLabel: $('gngNoGoLabel'),
            ruleText: $('gngRuleText'),
            playBtn: $('gngPlayBtn'),
            speedDisplay: $('gngSpeedDisplay'),
            speedDown: $('gngSpeedDown'),
            speedUp: $('gngSpeedUp'),
            goBtn: $('gngGoBtn'),
            noBtn: $('gngNoGoBtn'),
            backBtn: $('gngBackBtn'),
            settingsBackBtn: $('gngSettingsBackBtn'),
            goCategory: $('gngGoCategory'),
            noGoCategory: $('gngNoGoCategory'),
            autoToggle: $('gngAutoToggle'),
            switchType: $('gngSwitchType'),
            switchFreq: $('gngSwitchFreq'),
            startBtn: $('gngStartBtn'),
            saveSettingsBtn: $('gngSaveSettingsBtn')
        };
    }

    function renderGngImage(doc, els, items, onMagnify) {
        const count = items.length;
        els.gridContainer.className = `gng-grid-container cols-${count}`;
        els.gridContainer.innerHTML = '';
        items.forEach(item => {
            const card = doc.createElement('div');
            card.className = 'gng-card';
            const img = doc.createElement('img');
            img.src = item.image;
            img.alt = '';
            img.setAttribute('aria-label', item.name);
            img.onerror = function () {
                this.style.display = 'none';
                const fallback = doc.createElement('span');
                fallback.textContent = '🖼️';
                fallback.style.fontSize = 'calc(40px * var(--ui-scale))';
                this.parentElement.appendChild(fallback);
            };
            card.appendChild(img);
            const magnifyBtn = doc.createElement('button');
            magnifyBtn.className = 'magnify-btn gng-magnify-btn';
            magnifyBtn.textContent = '🔍';
            magnifyBtn.title = '放大圖片';
            magnifyBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (onMagnify) onMagnify(item.image, item.name);
            });
            card.appendChild(magnifyBtn);
            els.gridContainer.appendChild(card);
        });
    }

    // 回饋燈光落在遊戲卡片上（而非按鈕）
    function flashGngCards(els, correct) {
        clearTimeout(gngCardsTimer);
        const cards = Array.from(els.gridContainer.querySelectorAll('.gng-card'));
        cards.forEach(card => card.classList.remove('feedback-correct', 'feedback-wrong'));
        cards.forEach(card => card.classList.add(correct ? 'feedback-correct' : 'feedback-wrong'));
        gngCardsTimer = setTimeout(function () {
            cards.forEach(card => card.classList.remove('feedback-correct', 'feedback-wrong'));
        }, 600);
    }

    function setScore(scoreNum, score) { scoreNum.textContent = score; }

    function syncPlayButton(playBtn, playing) { playBtn.classList.toggle('playing', playing); }

    function syncSessionButton(playBtn, playing, isRunning) { playBtn.classList.toggle('playing', playing && isRunning); }

    function updateRuleLabels(els, goCat, noGoCat) {
        const goDisplay = goCat === '全部' ? '其他' : goCat;
        const noGoDisplay = noGoCat === '全部' ? '其他' : noGoCat;
        els.goLabel.textContent = goDisplay;
        els.noGoLabel.textContent = noGoDisplay;
        return { goDisplay: goDisplay, noGoDisplay: noGoDisplay };
    }

    function showRuleChangePopup(message, goCat, noGoCat) {
        const goDisplay = goCat === '全部' ? '其他' : goCat;
        const noGoDisplay = noGoCat === '全部' ? '其他' : noGoCat;
        message.show({
            title: `任務已變更：✅ ${goDisplay} → ❌ ${noGoDisplay}`,
            subtitle: '',
            pauseTimer: true
        });
    }

    function showIntro(message, ruleText) {
        message.show({
            title: ruleText,
            subtitle: '',
            extraLarge: true,
            pauseTimer: false
        });
    }

    function syncAutoToggle(btn, on) {
        btn.textContent = on ? '開啟' : '關閉';
        btn.style.borderColor = on ? 'var(--highlight-correct)' : 'var(--border-color)';
        btn.style.background = on ? 'var(--toggle-on-bg)' : 'var(--card-bg)';
    }

    function applySettings(els, prefs) {
        els.goCategory.value = prefs.goCategory;
        els.noGoCategory.value = prefs.noGoCategory;
        els.switchType.value = prefs.switchType;
        els.switchFreq.value = String(prefs.switchFreq);
    }
    function bindGngControls(els, keyboard, listenOpts, handlers) {
        handlers = handlers || {};
        if (els.autoToggle) {
            els.autoToggle.addEventListener('click', function () {
                if (handlers.onAutoToggle) handlers.onAutoToggle(els.autoToggle);
            }, listenOpts);
        }
        if (els.startBtn) {
            els.startBtn.addEventListener('click', function () {
                if (handlers.onStart) handlers.onStart();
            }, listenOpts);
        }
        if (els.backBtn) {
            els.backBtn.addEventListener('click', function () {
                if (handlers.onBack) handlers.onBack();
            }, listenOpts);
        }
        if (els.settingsBackBtn) {
            els.settingsBackBtn.addEventListener('click', function () {
                if (handlers.onSettingsBack) handlers.onSettingsBack();
            }, listenOpts);
        }
        if (els.playBtn) {
            els.playBtn.addEventListener('click', function () {
                if (handlers.onPlayPause) handlers.onPlayPause();
            }, listenOpts);
        }
        if (els.goBtn) {
            els.goBtn.addEventListener('click', function () {
                if (handlers.onGo) handlers.onGo();
            }, listenOpts);
        }
        if (els.noBtn) {
            els.noBtn.addEventListener('click', function () {
                if (handlers.onNoGo) handlers.onNoGo();
            }, listenOpts);
        }
        if (els.speedDown) {
            els.speedDown.addEventListener('click', function () {
                if (handlers.onSpeed) handlers.onSpeed(-1);
            }, listenOpts);
        }
        if (els.speedUp) {
            els.speedUp.addEventListener('click', function () {
                if (handlers.onSpeed) handlers.onSpeed(1);
            }, listenOpts);
        }
        if (els.gridWrapper) {
            els.gridWrapper.addEventListener('click', function (e) {
                if (handlers.onGridClick) handlers.onGridClick(e);
            }, listenOpts);
        }
        if (els.ruleText) {
            els.ruleText.addEventListener('click', function (e) {
                if (handlers.onRuleTextClick) handlers.onRuleTextClick(e);
            }, listenOpts);
        }
        if (els.saveSettingsBtn) {
            els.saveSettingsBtn.addEventListener('click', function () {
                if (handlers.onSaveSettings) handlers.onSaveSettings();
            }, listenOpts);
        }
        if (keyboard) {
            keyboard.registerScreen('gngGame', handlers.keyboard || {});
        }
    }

    var api = {
        createGngEls: createGngEls,
        renderGngImage: renderGngImage,
        flashGngCards: flashGngCards,
        setScore: setScore,
        syncPlayButton: syncPlayButton,
        syncSessionButton: syncSessionButton,
        updateRuleLabels: updateRuleLabels,
        showRuleChangePopup: showRuleChangePopup,
        showIntro: showIntro,
        syncAutoToggle: syncAutoToggle,
        applySettings: applySettings,
        bindGngControls: bindGngControls
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveGngView = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);