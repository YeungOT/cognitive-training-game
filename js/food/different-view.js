(function (global) {
    'use strict';

    // =============================================================
    // 找不同遊戲 — view helpers
    // =============================================================
    //
    // DOM building only: the 找不同 card/grid renderer. No game state,
    // timers, or business logic. Callbacks are injected so this module
    // stays unit-testable.

    function createDifferentCard(doc, item, index, callbacks) {
        callbacks = callbacks || {};
        const card = doc.createElement('div');
        card.className = 'different-card';
        card.dataset.index = index;
        card.dataset.correct = item.isCorrect ? 'true' : 'false';

        const magnifyBtn = doc.createElement('button');
        magnifyBtn.className = 'magnify-btn different-magnify-btn';
        magnifyBtn.textContent = '🔍';
        magnifyBtn.title = '放大圖片';
        magnifyBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (callbacks.onMagnify) callbacks.onMagnify(item.image, item.name, false);
        });

        const img = doc.createElement('img');
        img.src = item.image;
        img.alt = item.name;
        img.setAttribute('aria-label', item.name);
        img.loading = 'lazy';
        img.onerror = function () {
            this.style.display = 'none';
            const fallback = doc.createElement('span');
            fallback.textContent = '🖼️';
            fallback.style.fontSize = 'calc(40px * var(--ui-scale))';
            card.appendChild(fallback);
        };

        card.appendChild(magnifyBtn);
        card.appendChild(img);
        card.addEventListener('click', function () {
            if (callbacks.onCardClick) callbacks.onCardClick(index);
        });
        return card;
    }

    function renderDifferentGrid(doc, gridContainer, items, callbacks) {
        callbacks = callbacks || {};
        const count = items.length;
        gridContainer.className = `different-grid-container count-${count}`;
        gridContainer.innerHTML = '';

        if (count === 5) {
            const topRow = doc.createElement('div');
            topRow.className = 'different-row';
            const bottomRow = doc.createElement('div');
            bottomRow.className = 'different-row';
            items.forEach((item, index) => {
                (index < 3 ? topRow : bottomRow).appendChild(createDifferentCard(doc, item, index, callbacks));
            });
            gridContainer.appendChild(topRow);
            gridContainer.appendChild(bottomRow);
        } else {
            items.forEach((item, index) => {
                gridContainer.appendChild(createDifferentCard(doc, item, index, callbacks));
            });
        }
    }

    var api = {
        createDifferentCard: createDifferentCard,
        renderDifferentGrid: renderDifferentGrid
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof window !== 'undefined') {
        window.CognitiveDifferentView = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);