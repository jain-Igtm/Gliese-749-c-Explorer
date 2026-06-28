# Gliese-749-c Explorer

A browser-based planetary exploration prototype by Strawberry Games.

The opening scene places the player inside a survey vehicle on **Gliese-749-c**, commonly known as **New Haven**. The world is technically habitable, but only in the strict bureaucratic sense: breathable atmosphere by regulation, fierce wind in practice, poor signal, low visibility, mineral grit across the glass, and uncertain terrain beyond the cabin lights.

## Current direction

- Start inside the vehicle rather than spawning outdoors.
- Use canvas rendering and procedural textures instead of obvious Three.js geometric shapes.
- Keep the project split into folders so `index.html` stays clean.
- Build atmosphere first: cockpit glass, dust, wind, instrument glow, hostile landscape.
- Keep mobile controls available for phone testing.

## File structure

```text
index.html
src/
  styles.css
  main.js
  textures.js
```

## Controls

Desktop:

- WASD / arrow keys: move
- Mouse drag: look

Mobile:

- Left stick: move
- Right stick: look

## Notes

This is the first playable foundation. It is intentionally not Forest Explorer with a space skin. The goal is a separate identity: harsh exoplanet survey, vehicle interior, environmental pressure, and texture-driven atmosphere.
