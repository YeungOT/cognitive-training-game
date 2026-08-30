        (function (global) {
            'use strict';

            // 從 CSS Token 解析實際長度（與 CSS 同一來源，safe-area 一致）
            function resolveCssVarLength(name, axis) {
                const probe = document.createElement('div');
                probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;';
                if (axis === 'h') probe.style.height = name;
                else probe.style.width = name;
                document.body.appendChild(probe);
                const size = axis === 'h' ? probe.getBoundingClientRect().height : probe.getBoundingClientRect().width;
                probe.remove();
                return size;
            }

            // 各遊戲的「舞台」容器（flex:1，決定格線可用空間）
            const STAGE_SELECTORS =
                '.grid-wrapper, .different-grid-wrapper, .gng-grid-wrapper, ' +
                '.nback-grid-wrapper, .dual-stage, .shopping-stage';

            function measureStageHeight(container) {
                const stage = container.querySelector(STAGE_SELECTORS);
                if (!stage) return null;
                const cs = getComputedStyle(stage);
                const padTop = parseFloat(cs.paddingTop) || 0;
                const padBottom = parseFloat(cs.paddingBottom) || 0;
                return Math.max(0, stage.clientHeight - padTop - padBottom);
            }

            // 讓格線公式使用「真實舞台高度」而非固定 Token 估算：
            // 取 min(估算, 實際)，標準裝置維持現有排版；裝置實際空間不足時改用真實高度，
            // 避免多列格線（如購物 6/8）溢出被 overflow:hidden 裁切。
            function syncStageHeights() {
                const containers = document.querySelectorAll('.game-container');
                for (let i = 0; i < containers.length; i++) {
                    const container = containers[i];
                    if (container.classList.contains('hidden')) continue;
                    const real = measureStageHeight(container);
                    if (real === null) continue;
                    const availH = resolveCssVarLength('var(--avail-h)', 'h');
                    const stageExtra = resolveCssVarLength('var(--stage-extra-h)', 'h');
                    const fallback = availH - stageExtra;
                    container.style.setProperty('--stage-h', Math.round(Math.min(fallback, real)) + 'px');
                }
            }

            // iPadOS standalone 模式：版面視窗貼齊頂部，outerHeight > innerHeight，
            // 底部 32px 為可繪製但不在版面內的區域。把差值存入 CSS var，
            // 讓 fixed 全螢幕圖層（側選單、背幕、直立鎖）延伸覆蓋。
            function syncWindowUnderflow() {
                var standalone = false;
                if (global.matchMedia) {
                    standalone =
                        global.matchMedia('(display-mode: standalone)').matches ||
                        global.matchMedia('(display-mode: fullscreen)').matches;
                }
                if (typeof navigator !== 'undefined' && navigator.standalone === true) standalone = true;
                var gap = standalone ? Math.max(0, (global.outerHeight || 0) - (global.innerHeight || 0)) : 0;
                document.documentElement.style.setProperty('--app-underflow', gap + 'px');
                document.documentElement.classList.toggle('pwa-standalone', gap > 0);
            }

            global.CognitiveLayout = {
                resolveCssVarLength: resolveCssVarLength,
                syncStageHeights: syncStageHeights,
                syncWindowUnderflow: syncWindowUnderflow
            };
            global.syncStageHeights = syncStageHeights;
            global.syncWindowUnderflow = syncWindowUnderflow;

            if (typeof window !== 'undefined') {
                window.addEventListener('resize', syncStageHeights);
                window.addEventListener('orientationchange', syncStageHeights);
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', syncStageHeights);
                } else {
                    syncStageHeights();
                }
            }
        })(typeof window !== 'undefined' ? window : globalThis);
