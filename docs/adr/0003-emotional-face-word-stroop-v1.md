# Emotional face–word Stroop v1 is a single face-target care-home game

The care-home setting and the emotional Stroop literature constrain the first version. v1 is a single face-target emotional face–word Stroop: the player classifies the face and ignores the word. It uses happy and sad faces plus a matched neutral-word baseline; the word-target direction and the mode setting were removed as unnecessary. Three conditions (congruent, incongruent, neutral-word) are mixed 1:1:1 in 48 scored trials; there is no separate practice phase or phase label. Pacing follows the existing reaction games: the round opens paused, clicking the stage advances one trial, the play button starts auto-advance, and the speed control sets the interval. The distractor word is red, unboxed, three times the previous size, and placed lower on the face. The exact Go/No-Go action buttons and instruction-message format are reused; the visible Chinese uses formal written labels. The 96-trial ABCD-style 75/25 and 50/50 assessment profile remains deferred.

## Status

Accepted

## Considered Options

- **Word-target mode** — rejected. The user removed the mode setting; v1 is the face-target task only.
- **Separate practice phase** — rejected. The six practice trials and the `練習` badge made the scoring inconsistent; v1 uses 48 scored trials with no phase label.
- **White box behind the distractor** — rejected. The word is red and unboxed, with a subtle light text shadow for legibility.
- **Thirty shipped images** — rejected. The neutral face images were only needed for the word-target neutral condition; the shipped PWA set is back to the 20 happy/sad images, while the Face Set manifest keeps the full six-expression domain for future games.
- **Settings screen** — rejected. With no mode or response-time setting, the home tile opens the game directly and the game back button returns home.

## Consequences

- The Face Set manifest remains the reuse seam and still defines all six expression keys; the current game consumes happy/sad only.
- `stroop-settings.js` was removed; `stroop-screen.js` defines the single game screen.
- `cognitiveStroopPrefs` was removed from the settings store.
- The trial generator, session, playback and response modules are face-target only; the session records condition, correctness, reaction time and timeout, with no phase or target-mode field.
- The game starts paused (manual mode), the stage click advances, the play button auto-advances, and the speed control sets the interval. A response shows the shared feedback; in auto mode it advances after 600 ms, while in manual mode it waits for the next stage click.
