(function () {
    'use strict';
    var TAP_COUNT = 5, TAP_WINDOW = 2500;
    var taps = 0, firstTapTime = 0, panel = null;
    function buildPanel() {
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'ipadGeoProbe';
        panel.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;color:#000;'
            + 'font:14px/1.5 monospace;padding:20px;overflow:auto;white-space:pre-wrap;';
        document.body.appendChild(panel);
    }
    function render() {
        var vv = window.visualViewport || {};
        var cs = getComputedStyle(document.documentElement);
        var menu = document.getElementById('slideMenu');
        var cont = document.querySelector('.game-container:not(.hidden)') || document.querySelector('.app-screen:not(.hidden)');
        var footer = cont ? cont.querySelector('.bottom-controls, .footer') : null;
        var probeRect = document.getElementById('ipadGeoProbe').getBoundingClientRect();
        var lines = [
            '=== iPad geometry probe ===',
            'screen: ' + window.screen.width + 'x' + window.screen.height,
            'innerHeight: ' + window.innerHeight,
            'outerHeight: ' + window.outerHeight,
            'vv.height: ' + vv.height + ' vv.offsetTop: ' + vv.offsetTop + ' vv.pageTop: ' + vv.pageTop,
            'safe-top CSS: ' + cs.getPropertyValue('--safe-top').trim(),
            'safe-bottom CSS: ' + cs.getPropertyValue('--safe-bottom').trim(),
            'safe-cap-bottom CSS: ' + cs.getPropertyValue('--safe-cap-bottom').trim(),
            'avail-h CSS: ' + cs.getPropertyValue('--avail-h').trim(),
            'container: ' + (cont ? cont.id + ' h=' + cont.getBoundingClientRect().height + ' bottom=' + cont.getBoundingClientRect().bottom : 'none'),
            'footer: ' + (footer ? 'h=' + footer.getBoundingClientRect().height + ' bottom=' + footer.getBoundingClientRect().bottom : 'none'),
            'menu bottom: ' + (menu ? menu.getBoundingClientRect().bottom : 'none'),
            'menu pad-bottom: ' + (menu ? getComputedStyle(menu).paddingBottom : 'none'),
            'scrollH: ' + document.scrollingElement.scrollHeight,
            'docClientH: ' + document.documentElement.clientHeight,
            'env(safe-area-inset-bottom): ' + cs.getPropertyValue('env(safe-area-inset-bottom)').trim(),
            'probe bottom: ' + probeRect.bottom,
            '',
            'Tap this panel 5x quickly to close.'
        ];
        panel.textContent = lines.join('\n');
    }
    function onTap(e) {
        e.stopPropagation();
        var now = Date.now();
        if (now - firstTapTime > TAP_WINDOW) { taps = 0; }
        if (taps === 0) firstTapTime = now;
        taps++;
        if (taps >= TAP_COUNT) {
            if (panel) { panel.remove(); panel = null; taps = 0; return; }
            buildPanel(); render();
        }
    }
    document.addEventListener('pointerdown', onTap, true);
})();