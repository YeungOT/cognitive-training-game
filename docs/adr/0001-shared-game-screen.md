# Shared Game Screen owns registry-driven game chrome

Most registry-driven cognitive games repeat the same screen composition: top bar, stage, footer or bottom controls, settings screen, instruction flow, and lifecycle wiring. We decided to deepen this into one `Game Screen` module so games declare content and screen intent while the module owns layout, shared controls, settings chrome, and the first-interaction rule.

## Status

Accepted

## Considered Options

- **CSS-only helpers** — rejected because layout knowledge still leaked into every game.
- **Static HTML templates** — rejected because copying templates would preserve drift.
- **One shared JS-rendered Game Screen** — accepted because it gives one seam for layout, instruction, settings, and lifecycle delegation.

## Consequences

- Game modules keep their own logic, views, and lifecycle callbacks.
- Router continues to own navigation; Game Screen owns screen composition.
- Existing element IDs and class names remain the compatibility contract.
- New games should not hand-write the shared screen skeleton.
