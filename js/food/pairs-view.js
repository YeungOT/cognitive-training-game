(function (global) {
    'use strict';

    function createMemoryPairsCard(doc, card, index, callbacks) {
        callbacks = callbacks || {};
        const el = doc.createElement('div');
        el.className = 'dual-grid-cell memory-card';
        el.dataset.index = String(index);
        el.dataset.pairId = card.pairId;

        const inner = doc.createElement('div');
        inner.className = 'memory-card-inner';

        const back = doc.createElement('div');
        back.className = 'memory-card-back';
        back.textContent = '?';

        const front = doc.createElement('div');
        front.className = 'memory-card-front';
        const img = doc.createElement('img');
        img.src = card.image;
        img.alt = '';
        img.setAttribute('aria-label', card.name);
        img.loading = 'lazy';
        img.addEventListener('error', function () {
            img.style.display = 'none';
            const fallback = doc.createElement('span');
            fallback.textContent = '🖼️';
            fallback.className = 'memory-card-fallback';
            front.appendChild(fallback);
        }, { once: true });
        front.appendChild(img);

        inner.appendChild(back);
        inner.appendChild(front);
        el.appendChild(inner);
        el.addEventListener('click', function () {
            if (callbacks.onCardClick) callbacks.onCardClick(index);
        });
        return el;
    }

    function renderMemoryPairsGrid(doc, gridContainer, cards, pairCount, callbacks) {
        callbacks = callbacks || {};
        gridContainer.className = 'dual-grid dual-grid-' + pairCount + 'x2';
        gridContainer.style.setProperty('--grid-cols', String(pairCount));
        gridContainer.style.setProperty('--grid-rows', '2');
        gridContainer.textContent = '';
        cards.forEach(function (card, index) {
            gridContainer.appendChild(createMemoryPairsCard(doc, card, index, callbacks));
        });
        return gridContainer;
    }

    function setCardClass(gridContainer, index, className, enabled) {
        const card = gridContainer.querySelector('.memory-card[data-index="' + index + '"]');
        if (card) card.classList.toggle(className, enabled);
    }

    function clearCardSelection(gridContainer, indexes) {
        indexes.forEach(function (index) {
            setCardClass(gridContainer, index, 'is-flipped', false);
            setCardClass(gridContainer, index, 'is-wrong', false);
        });
    }

    var api = {
        setCardClass: setCardClass,
        clearCardSelection: clearCardSelection,        createMemoryPairsCard: createMemoryPairsCard,
        renderMemoryPairsGrid: renderMemoryPairsGrid
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.CognitivePairsView = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
