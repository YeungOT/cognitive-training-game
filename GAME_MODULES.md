# Game module guide

Use this checklist when adding a game. Keep each new game small and consistent with the existing app.

## 1. Design gate

Before coding, answer:

- Clinical goal: what ability does the game train?
- Player action: what does the user tap or choose?
- Round flow: what happens before, during, and after a round?
- Difficulty settings: which settings are necessary for the first version?
- Feedback: correct, wrong, score, and round progress.
- Elderly-readable UI: Traditional Chinese labels, large targets, no essential text below 18px-equivalent visual size.

## 2. Files

Typical module shape:

- `js/food/<game>.js` — mount, lifecycle, navigation, scoring.
- `js/food/<game>-logic.js` — pure round generation/rules when testable logic exists.
- `js/food/<game>-view.js` — direct DOM rendering when the view is non-trivial.
- `css/<game>.css` — only game-specific styles; reuse shared classes first.
- `tests/<game>.test.mjs` — at least pure logic + lifecycle seam tests.
- `index.html` — one screen block per visible route.

Keep every code file below 300 lines. Split before crossing the limit.

## 3. Registry registration

Register the game through `window.CognitiveGames.register()`.

Required metadata:

```js
window.CognitiveGames.register({
  id: 'example',
  title: '示例遊戲',
  icon: '🧩',
  entryRoute: 'exampleGame',
  buttonId: 'gameExampleBtn',
  menuOrder: 6,
  setup: function () {
    return api.mount(document, {
      foodData: window.CognitiveFoodData,
      feedback: window.CognitiveFeedback,
      router: window.CognitiveRouter,
      audio: window.CognitiveAudio
    });
  }
});
```

Rules:

- `id` is unique and stable.
- `menuOrder` is unique.
- `entryRoute` matches the HTML screen id.
- `setup()` must return lifecycle methods: `start`, `pause`, `reset`, `destroy`.
- Registry navigation pauses the previously active game.

## 4. Screen and layout

Use the existing game layout first:

- `.game-container.app-screen`
- `.top-bar` with back button, question/rules, score/menu
- a shared stage/wrapper pattern
- `.bottom-controls` when the game has play, speed, or match controls

Do not invent a new visual system. Add CSS only for behaviour that shared classes do not already cover.

## 5. Lifecycle

Every game must fail fast and clean up timers/listeners.

Minimum lifecycle:

- `start()` — prepare or start a round.
- `pause()` — stop timers/activity and show no stale feedback.
- `reset()` — clear score/round/state.
- `destroy()` — abort listeners and stop timers.

Use `AbortController` for listeners where practical. Never swallow errors.

## 6. Checks before commit

Run:

1. `node --check` on each edited JS file.
2. Game tests.
3. `npm run build:sw` if HTML, JS, CSS, or assets changed.
4. `git diff --check`.
5. Browser check:
   - main menu shows the new button
   - route opens the correct screen
   - first round starts correctly
   - pause/reset works
   - back navigation pauses the game
   - no console/page errors

## 7. Commit

Commit the game as one focused change. Do not mix unrelated refactors.
