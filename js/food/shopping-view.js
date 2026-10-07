(function (global) {
    'use strict';

    // =============================================================
    // 買餸記憶遊戲 — view (UI layer)
    // =============================================================
    //
    // Owns every direct DOM interaction of the shopping game: element lookup,
    // list/order/recall renders, the order lightbulb animation, settings
    // memory-options, score/progress/timer display, popups, and control
    // binding. No game state or business logic - callbacks injected.

    function createShoppingEls(doc) {
        var $ = function (id) { return doc.getElementById(id); };
        return {
            game: $('shoppingGame'),
            settings: $('shoppingSettings'),
            stage: $('shoppingStage'),
            phaseText: $('shoppingPhaseText'),
            listView: $('shoppingListView'),
            recallView: $('shoppingRecallView'),
            orderView: $('shoppingOrderView'),
            listGrid: $('shoppingListGrid'),
            listHint: $('shoppingListHint'),
            recallGrid: $('shoppingRecallGrid'),
            orderItem: $('shoppingOrderItem'),
            orderIndicator: $('shoppingOrderIndicator'),
            orderLightbulb: $('shoppingOrderLightbulb'),
            scoreNum: $('shoppingScoreNum'),
            progress: $('shoppingProgress'),
            timer: $('shoppingTimer'),
            manualStartBtn: $('shoppingManualStartBtn'),
            nameToggleBtn: $('shoppingNameToggleBtn'),
            backBtn: $('shoppingBackBtn'),
            settingsBackBtn: $('shoppingSettingsBackBtn'),
            startBtn: $('shoppingStartBtn'),
            listDisplayMode: $('shoppingListDisplayMode'),
            listCount: $('shoppingListCount'),
            memoryTime: $('shoppingMemoryTime'),
            memoryTimeSuffix: $('shoppingMemoryTimeSuffix'),
            choiceCount: $('shoppingChoiceCount'),
            orderRequired: $('shoppingOrderRequired'),
            recallTime: $('shoppingRecallTime'),
            saveSettingsBtn: $('shoppingSaveSettingsBtn')
        };
    }

    // Order-mode lightbulb animation; owns its hide timer.
    function createShoppingLightbulb(els) {
        var bulbHideTimer = null;

        function setInitial(orderMode) {
            const bulb = els.orderLightbulb;
            if (!bulb) return;
            if (bulbHideTimer) {
                clearTimeout(bulbHideTimer);
                bulbHideTimer = null;
            }
            bulb.classList.remove('visible', 'exit', 'flash');
            bulb.classList.toggle('hidden', !orderMode);
            if (orderMode) bulb.classList.add('visible');
        }

        function show() {
            const bulb = els.orderLightbulb;
            if (!bulb) return;
            if (bulbHideTimer) {
                clearTimeout(bulbHideTimer);
                bulbHideTimer = null;
            }
            bulb.classList.remove('exit', 'flash', 'hidden');
            void bulb.offsetWidth;
            bulb.classList.add('visible');
        }

        function hide() {
            const bulb = els.orderLightbulb;
            if (!bulb) return;
            if (bulbHideTimer) {
                clearTimeout(bulbHideTimer);
                bulbHideTimer = null;
            }
            if (bulb.classList.contains('hidden')) return;
            bulb.classList.remove('visible', 'exit', 'flash');
            void bulb.offsetWidth;
            bulb.classList.add('exit');
            bulbHideTimer = setTimeout(function () {
                bulb.classList.add('hidden');
                bulb.classList.remove('exit');
                bulbHideTimer = null;
            }, 450);
        }

        return { setInitial: setInitial, show: show, hide: hide };
    }

    function updateMemoryOptions(els, standardOptions, orderOptions, lightbulb, animateBulb) {
        const orderMode = els.orderRequired.value === 'true';
        const options = orderMode ? orderOptions : standardOptions;
        const currentValue = els.memoryTime.value;
        const validValues = options.map(option => option[0]);
        els.memoryTime.innerHTML = options.map(option =>
            `<option value="${option[0]}">${option[1]}</option>`
        ).join('');
        els.memoryTime.value = validValues.includes(currentValue) ? currentValue : 'manual';
        if (els.memoryTimeSuffix) {
            els.memoryTimeSuffix.classList.toggle('active', orderMode);
            els.memoryTimeSuffix.setAttribute('aria-hidden', orderMode ? 'false' : 'true');
        }
        if (animateBulb) {
            lightbulb.show();
        } else {
            lightbulb.setInitial(orderMode);
        }
    }
    function renderShoppingList(doc, els, opts) {
        opts = opts || {};
        const list = opts.list || [];
        const count = list.length;
        const listDisplayMode = opts.listDisplayMode;
        const showNames = !!opts.showNames;
        const onMagnify = opts.onMagnify;
        els.listGrid.className = `shopping-list-grid count-${count}`;
        els.listGrid.classList.toggle('name-mode', listDisplayMode === 'name');
        els.listGrid.innerHTML = '';
        const showImage = listDisplayMode !== 'name';
        const showName = listDisplayMode === 'name' || (showImage && showNames);
        els.listHint.textContent = '';

        function createCard(item) {
            const card = doc.createElement('div');
            card.className = 'shopping-list-card';
            if (showImage) {
                const magnifyBtn = doc.createElement('button');
                magnifyBtn.className = 'magnify-btn';
                magnifyBtn.textContent = '🔍';
                magnifyBtn.title = '放大圖片';
                magnifyBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (onMagnify) onMagnify(item.image, item.name, showName);
                });
                card.appendChild(magnifyBtn);
                const imgWrapper = doc.createElement('div');
                imgWrapper.className = 'food-image';
                const img = doc.createElement('img');
                img.src = item.image;
                img.alt = item.name;
                img.loading = 'lazy';
                img.onerror = function () {
                    this.style.display = 'none';
                    const fallback = doc.createElement('span');
                    fallback.textContent = '🖼️';
                    fallback.style.fontSize = 'calc(44px * var(--ui-scale))';
                    this.parentElement.appendChild(fallback);
                };
                imgWrapper.appendChild(img);
                card.appendChild(imgWrapper);
            } else {
                card.classList.add('name-only');
            }
            const nameSpan = doc.createElement('div');
            nameSpan.className = 'food-name';
            nameSpan.textContent = item.name;
            card.appendChild(nameSpan);
            return card;
        }

        const topRow = doc.createElement('div');
        topRow.className = 'shopping-list-row';
        const bottomRow = doc.createElement('div');
        bottomRow.className = 'shopping-list-row';
        list.forEach((item, index) => {
            const card = createCard(item);
            if (count === 5) {
                (index < 3 ? topRow : bottomRow).appendChild(card);
            } else {
                els.listGrid.appendChild(card);
            }
        });
        if (count === 5) {
            els.listGrid.appendChild(topRow);
            els.listGrid.appendChild(bottomRow);
        }
    }

    function renderShoppingOrderItem(doc, els, opts) {
        opts = opts || {};
        const item = opts.item;
        if (!item) return;
        const listDisplayMode = opts.listDisplayMode;
        const showNames = !!opts.showNames;
        const onMagnify = opts.onMagnify;
        const showImage = listDisplayMode !== 'name';
        const showName = listDisplayMode === 'name' || (showImage && showNames);
        els.orderItem.innerHTML = '';
        const card = doc.createElement('div');
        card.className = 'shopping-order-card';
        if (!showImage) card.classList.add('name-only');
        if (showImage) {
            const magnifyBtn = doc.createElement('button');
            magnifyBtn.className = 'magnify-btn';
            magnifyBtn.textContent = '🔍';
            magnifyBtn.title = '放大圖片';
            magnifyBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (onMagnify) onMagnify(item.image, item.name, showName);
            });
            card.appendChild(magnifyBtn);
            const imgWrapper = doc.createElement('div');
            imgWrapper.className = 'food-image';
            const img = doc.createElement('img');
            img.src = item.image;
            img.alt = item.name;
            img.onerror = function () {
                this.style.display = 'none';
                const fallback = doc.createElement('span');
                fallback.textContent = '🖼️';
                fallback.style.fontSize = 'calc(72px * var(--ui-scale))';
                this.parentElement.appendChild(fallback);
            };
            imgWrapper.appendChild(img);
            card.appendChild(imgWrapper);
        }
        const nameSpan = doc.createElement('div');
        nameSpan.className = 'food-name';
        nameSpan.textContent = item.name;
        card.appendChild(nameSpan);
        els.orderItem.appendChild(card);
    }
    function renderShoppingRecallGrid(doc, els, opts) {
        opts = opts || {};
        const gridItems = opts.gridItems || [];
        const list = opts.list || [];
        const orderRequired = !!opts.orderRequired;
        const completedNames = opts.completedNames || [];
        const getFoodId = opts.getFoodId;
        const onCardClick = opts.onCardClick;
        const onMagnify = opts.onMagnify;
        const count = gridItems.length;
        els.recallGrid.className = `shopping-recall-grid count-${count}`;
        els.recallGrid.innerHTML = '';
        gridItems.forEach((item, index) => {
            const card = doc.createElement('div');
            card.className = 'shopping-recall-card';
            card.dataset.index = index;
            card.dataset.target = item.isTarget ? 'true' : 'false';
            const magnifyBtn = doc.createElement('button');
            magnifyBtn.className = 'magnify-btn';
            magnifyBtn.textContent = '🔍';
            magnifyBtn.title = '放大圖片';
            magnifyBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (onMagnify) onMagnify(item.image, item.name);
            });
            const imgWrapper = doc.createElement('div');
            imgWrapper.className = 'food-image';
            const img = doc.createElement('img');
            img.src = item.image;
            img.alt = item.name;
            img.loading = 'lazy';
            img.onerror = function () {
                this.style.display = 'none';
                const fallback = doc.createElement('span');
                fallback.textContent = '🖼️';
                fallback.style.fontSize = 'calc(44px * var(--ui-scale))';
                this.parentElement.appendChild(fallback);
            };
            imgWrapper.appendChild(img);
            const nameSpan = doc.createElement('div');
            nameSpan.className = 'food-name';
            nameSpan.textContent = item.name;
            const badge = doc.createElement('span');
            badge.className = 'shopping-selected-badge';
            badge.textContent = '';
            if (completedNames.includes(getFoodId(item))) {
                card.classList.add('selected', 'feedback-correct');
                const orderNumber = list.findIndex(listItem => getFoodId(listItem) === getFoodId(item)) + 1;
                badge.textContent = orderRequired ? String(orderNumber) : '✓';
                badge.classList.add('visible');
            }
            card.appendChild(magnifyBtn);
            card.appendChild(badge);
            card.appendChild(imgWrapper);
            card.appendChild(nameSpan);
            card.addEventListener('click', function () {
                if (onCardClick) onCardClick(index);
            });
            els.recallGrid.appendChild(card);
        });
    }

    function setScore(scoreNum, score) { scoreNum.textContent = score; }
    function setProgress(progress, done, total) {
        progress.textContent = done >= total && total > 0 ? `✅ 已完成 ${total} / ${total}` : `已揀選 ${done} / ${total}`;
    }
    function setTimer(timer, phase, timerActive, countdown) {
        const active = phase === 'list' || phase === 'order' || phase === 'recall';
        if (active && timerActive) {
            timer.textContent = `⏱ ${countdown} 秒`;
            timer.classList.toggle('alert', countdown <= 5);
        } else {
            timer.textContent = '--';
            timer.classList.remove('alert');
        }
    }
    function showFeedback(feedback, stage, text, kind) { feedback.show(stage, text, kind); }
    function clearFeedback(feedback, stage) { feedback.clear(stage); }
    function showBeginIntro(message, title, onDismiss) {
        message.show({
            title: title,
            subtitle: '',
            extraLarge: true,
            pauseTimer: false,
            titleHtml: true,
            onDismiss: onDismiss
        });
    }

    function showRecallIntro(message, onDismiss) {
        message.show({
            title: '時間到，開始揀選',
            subtitle: '',
            extraLarge: true,
            pauseTimer: false,
            onDismiss: onDismiss
        });
    }

    function showComplete(message, listLength, score, onNext) {
        message.show({
            title: '🎉 買餸完成！',
            subtitle: `你正確揀選了 ${listLength} 樣食物，總得分 ${score}！`,
            dismissible: false,
            buttons: [{
                text: '下一輪 ➜',
                className: 'btn-restart',
                action: onNext
            }],
            onDismiss: onNext
        });
    }

    function showTimeout(message, onReplay) {
        message.show({
            title: '⏰ 時間到',
            subtitle: '先記住購物清單，再試一次！',
            buttons: [{
                text: '再看清單',
                className: 'btn-stay',
                action: onReplay
            }],
            onDismiss: onReplay
        });
    }

    function showSaved(message) {
        message.show({
            title: '設定已儲存',
            subtitle: '下次進入遊戲時會使用已儲存的偏好設定。',
            buttons: [{
                text: '好的',
                className: 'btn-stay',
                action: function () {}
            }],
            pauseTimer: false
        });
    }

    function bindShoppingControls(els, listenOpts, handlers) {
        handlers = handlers || {};
        if (els.orderRequired) {
            els.orderRequired.addEventListener('change', function () {
                if (handlers.onOrderRequiredChange) handlers.onOrderRequiredChange();
            }, listenOpts);
        }
        if (els.memoryTime) {
            els.memoryTime.addEventListener('click', function () {
                if (handlers.onMemoryTimeClick) handlers.onMemoryTimeClick();
            }, listenOpts);
            els.memoryTime.addEventListener('change', function () {
                if (handlers.onMemoryTimeChange) handlers.onMemoryTimeChange();
            }, listenOpts);
        }
        if (els.saveSettingsBtn) {
            els.saveSettingsBtn.addEventListener('click', function () {
                if (handlers.onSaveSettings) handlers.onSaveSettings();
            }, listenOpts);
        }
        if (els.manualStartBtn) {
            els.manualStartBtn.addEventListener('click', function () {
                if (handlers.onManualStart) handlers.onManualStart();
            }, listenOpts);
        }
        if (els.nameToggleBtn) {
            els.nameToggleBtn.addEventListener('click', function () {
                if (handlers.onNameToggle) handlers.onNameToggle(els.nameToggleBtn);
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
    }

    var api = {
        createShoppingEls: createShoppingEls,
        createShoppingLightbulb: createShoppingLightbulb,
        updateMemoryOptions: updateMemoryOptions,
        renderShoppingList: renderShoppingList,
        renderShoppingOrderItem: renderShoppingOrderItem,
        renderShoppingRecallGrid: renderShoppingRecallGrid,
        setScore: setScore,
        setProgress: setProgress,
        setTimer: setTimer,
        showFeedback: showFeedback,
        clearFeedback: clearFeedback,
        showBeginIntro: showBeginIntro,
        showRecallIntro: showRecallIntro,
        showComplete: showComplete,
        showTimeout: showTimeout,
        showSaved: showSaved,
        bindShoppingControls: bindShoppingControls
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveShoppingView = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
