# Gliese-749-c Explorer Changelog

## v0.0.1 - First Surface Wake

The first playable foundation is in place.

### Added

- Added the opening wake-up scene inside a survey vehicle.
- Added a harsh New Haven surface atmosphere: fierce wind, poor visibility, mineral grit, and dim red-star light.
- Added a cockpit-style HUD with cabin seal, signal, and scan readouts.
- Added procedural texture generation for ground grain, cockpit panels, windshield haze, and mineral scan targets.
- Added desktop controls and phone touch controls.
- Added a folder-based project structure so the game is no longer one monster HTML file.

### Technical

- Switched away from Three.js for this prototype foundation.
- Built the scene with HTML canvas and generated texture layers.
- Split code into `index.html`, `src/styles.css`, `src/main.js`, and `src/textures.js`.
- Kept the game lightweight for GitHub Pages and phone testing.

### Direction

This is not Forest Explorer in space. The focus is now vehicle interiors, harsh planetary atmosphere, exploration under bad conditions, and texture-driven visual identity.
