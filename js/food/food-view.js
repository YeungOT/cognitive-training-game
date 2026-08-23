(function (global) {
    'use strict';

    // =============================================================
    // 食物分類遊戲 — view (UI layer)
    // =============================================================
    //
    // Owns every direct DOM interaction of the food game: grid render,
    // category menu + completion badges, question-text presenter, and the
    // intro/complete/victory popups. No game state, timers, or business
    // logic - callbacks are injected so this module stays unit-testable.

    function createFoodEls(doc) {
        var $ = function (id) { return doc.getElementById(id); };
        return {
            grid: $('gridContainer'),
            gridWrapper: doc.querySelector('#foodGame .grid-wrapper'),
            questionText: $('questionText'),
            scoreNum: $('foodScoreNum'),
            roundInfo: $('foodRoundInfo'),
            countSelect: $('countSelect'),
            toggleNamesBtn: $('toggleNamesBtn'),
            backBtn: $('foodBackBtn'),
            categoryBackBtn: $('foodCategoryBackBtn'),
            categoryGrid: $('foodCategoryGrid'),
            foodGame: $('foodGame'),
            foodCategorySelect: $('foodCategorySelect')
        };
    }

    // Applies correct/wrong feedback classes to the clicked food card. The
    // wrong-flash timer is owned here (it only touches the card's class).
    function markFoodCard(doc, cards, index, correct) {
        const card = cards[index];
        if (!card) return;
        if (correct) {
            card.classList.add('feedback-correct');
            cards.forEach(c => c.classList.add('disabled'));
        } else {
            card.classList.add('feedback-wrong');
            setTimeout(function () { card.classList.remove('feedback-wrong'); }, 600);
        }
    }
    function renderFoodGrid(doc, grid, items, callbacks) {
        callbacks = callbacks || {};
        const total = items.length;
        grid.className = `grid-container cols-${total}`;
        grid.innerHTML = '';
        items.forEach((item, index) => {
            const card = doc.createElement('div');
            card.className = 'food-card';
            card.dataset.index = index;
            card.dataset.correct = item.isCorrect ? 'true' : 'false';

            const magnifyBtn = doc.createElement('button');
            magnifyBtn.className = 'magnify-btn';
            magnifyBtn.textContent = '🔍';
            magnifyBtn.title = '放大圖片';
            magnifyBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (callbacks.onMagnify) callbacks.onMagnify(item.image, item.name);
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
                fallback.style.fontSize = 'calc(50px * var(--ui-scale))';
                this.parentElement.appendChild(fallback);
            };
            imgWrapper.appendChild(img);

            const nameSpan = doc.createElement('div');
            nameSpan.className = 'food-name';
            nameSpan.textContent = item.name;

            card.appendChild(magnifyBtn);
            card.appendChild(imgWrapper);
            card.appendChild(nameSpan);
            card.addEventListener('click', function () {
                if (callbacks.onCardClick) callbacks.onCardClick(index);
            });
            grid.appendChild(card);
        });
    }

    // Owns the current question category + adaptive re-apply on resize.
    function clearFoodCards(doc) {
        doc.querySelectorAll('.food-card').forEach(card => {
            card.classList.remove('feedback-correct', 'feedback-wrong', 'disabled');
        });
    }

    function bindFoodControls(els, listenOpts, handlers) {
        handlers = handlers || {};
        if (els.backBtn) {
            els.backBtn.addEventListener('click', function () {
                if (handlers.onBack) handlers.onBack();
            }, listenOpts);
        }
        if (els.categoryBackBtn) {
            els.categoryBackBtn.addEventListener('click', function () {
                if (handlers.onCategoryBack) handlers.onCategoryBack();
            }, listenOpts);
        }
        if (els.countSelect) {
            els.countSelect.addEventListener('change', function () {
                if (handlers.onCountChange) handlers.onCountChange(els.countSelect.value);
            }, listenOpts);
        }
        if (els.toggleNamesBtn) {
            els.toggleNamesBtn.addEventListener('click', function () {
                if (handlers.onToggleNames) handlers.onToggleNames(els.toggleNamesBtn);
            }, listenOpts);
        }
    }
    function createQuestionText(questionText, getHtml, syncTopBarCentering) {
        var currentCategory = '';
        var adaptiveFrame = null;

        function set(category) {
            currentCategory = category;
            apply();
        }

        function apply() {
            if (!currentCategory) {
                questionText.innerHTML = '';
                return;
            }
            questionText.innerHTML = getHtml(currentCategory);
            requestAnimationFrame(function () {
                if (syncTopBarCentering) syncTopBarCentering();
            });
        }

        function schedule() {
            if (adaptiveFrame) cancelAnimationFrame(adaptiveFrame);
            adaptiveFrame = requestAnimationFrame(function () {
                adaptiveFrame = null;
                if (currentCategory) apply();
            });
        }

        function destroy() {
            if (adaptiveFrame) cancelAnimationFrame(adaptiveFrame);
            adaptiveFrame = null;
        }

        return { set: set, apply: apply, schedule: schedule, destroy: destroy };
    }
    function buildFoodCategoryGrid(doc, grid, opts) {
        opts = opts || {};
        const categoryNames = opts.categoryNames || [];
        const categoryIcons = opts.categoryIcons || {};
        const categoryCompleted = opts.categoryCompleted || {};
        const allDone = !!opts.allDone;
        grid.innerHTML = '';
        categoryNames.forEach(cat => {
            const btn = doc.createElement('button');
            btn.className = 'category-btn';
            if (categoryCompleted[cat]) btn.classList.add('completed');
            const icon = categoryIcons[cat] || '❓';
            const badge = categoryCompleted[cat] ? '<span class="complete-badge">✅</span>' : '';
            btn.innerHTML = `<span class="icon">${icon}</span><span class="label">${cat}</span>${badge}`;
            btn.dataset.category = cat;
            btn.addEventListener('click', function () {
                if (opts.onCategoryClick) opts.onCategoryClick(cat);
            });
            grid.appendChild(btn);
        });
        const randomBtn = doc.createElement('button');
        randomBtn.className = 'category-btn random-btn' + (allDone ? ' completed' : '');
        const badge = allDone ? '<span class="complete-badge">✅</span>' : '';
        randomBtn.innerHTML = `<span class="icon">🎲</span><span class="label">隨機</span>${badge}`;
        randomBtn.addEventListener('click', function () {
            if (opts.onRandomClick) opts.onRandomClick(allDone);
        });
        grid.appendChild(randomBtn);
    }

    function syncCategoryBadge(doc, btn, isComplete) {
        btn.classList.toggle('completed', isComplete);
        let badge = btn.querySelector('.complete-badge');
        if (isComplete && !badge) {
            badge = doc.createElement('span');
            badge.className = 'complete-badge';
            badge.textContent = '✅';
            btn.appendChild(badge);
        } else if (!isComplete && badge) {
            badge.remove();
        }
    }

    function updateFoodMenuButtons(doc, grid, opts) {
        opts = opts || {};
        const categoryCompleted = opts.categoryCompleted || {};
        const allDone = !!opts.allDone;
        const btns = grid.querySelectorAll('.category-btn');
        btns.forEach(btn => {
            const cat = btn.dataset.category;
            if (cat) {
                syncCategoryBadge(doc, btn, categoryCompleted[cat] || false);
            }
        });
        const randomBtn = grid.querySelector('.random-btn');
        if (randomBtn) {
            syncCategoryBadge(doc, randomBtn, allDone);
        }
    }

    function showIntro(message, html) {
        message.show({
            title: html,
            titleHtml: true,
            extraLarge: true,
            pauseTimer: false
        });
    }

    function showCategoryComplete(message, category, icon, onBack) {
        message.show({
            title: `${icon || '🎉'} 你已認識所有「${category}」的食物！`,
            subtitle: '太棒了！繼續挑戰其他類別吧！',
            buttons: [{ text: '返回選單', className: 'btn-stay', action: onBack }]
        });
    }

    function showVictoryScreen(message, onRestart) {
        message.show({
            title: '🏆 恭喜你！',
            subtitle: '你已經認識了所有類別的所有食物！\n你是真正的食物大師！ 🎉',
            isVictory: true,
            buttons: [{ text: '🔄 重新開始', className: 'btn-restart', action: onRestart }]
        });
    }

    var api = {
        createFoodEls: createFoodEls,
        renderFoodGrid: renderFoodGrid,
        markFoodCard: markFoodCard,
        clearFoodCards: clearFoodCards,
        bindFoodControls: bindFoodControls,
        createQuestionText: createQuestionText,
        setScore: function (scoreNum, score) { scoreNum.textContent = score; },
        setRound: function (roundInfo, round) { roundInfo.textContent = `第 ${round} 題`; },
        buildFoodCategoryGrid: buildFoodCategoryGrid,
        updateFoodMenuButtons: updateFoodMenuButtons,
        showIntro: showIntro,
        showCategoryComplete: showCategoryComplete,
        showVictoryScreen: showVictoryScreen
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveFoodView = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);