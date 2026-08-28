        // 第五部分：主選單與遊戲切換
        // =============================================================

        const mainMenu = document.getElementById('mainMenu');

        function goToMainMenu() {
            if (window.CognitiveMenu) {
                window.CognitiveMenu.close();
            }
            if (window.CognitiveRouter) {
                window.CognitiveRouter.goBack();
            }
        }

        if (!window.CognitiveGames) {
            throw new Error('Game registry is not available');
        }

        window.CognitiveGames.register({ id: 'food', title: '食物分類', icon: '❓', entryRoute: 'foodCategorySelect', buttonId: 'gameFoodBtn', menuOrder: 1 });
        window.CognitiveGames.register({ id: 'different', title: '找不同', icon: '🔍', entryRoute: 'differentGame', buttonId: 'gameDifferentBtn', menuOrder: 3 });
        window.CognitiveGames.register({ id: 'shopping', title: '買餸', icon: '🛒', entryRoute: 'shoppingSettings', buttonId: 'gameShoppingBtn', menuOrder: 4 });

        if (window.CognitiveRouter) {
            window.CognitiveRouter.defineScreen('mainMenu', {
                back: 'home'
            });
        }

        window.CognitiveGames.renderMenu(document.getElementById('mainMenuGrid'));

        // Name visibility is initialised by the shared NameVisibility singleton
        // in js/food/name-visibility.js (created at load, applied once), so no
        // bare showNames/applyNameVisibility call is needed here.

        console.log('✅ 所有遊戲已載入，使用 ☰ 選單控制設定！');
