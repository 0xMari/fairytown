# Fairytown

Fairytown is an explorable procedural fantasy world built for the browser with
Three.js. You fly through the landscape at fairy scale while terrain, water,
vegetation and magical landmarks are generated around the camera.

Rather than presenting a fixed environment, Fairytown builds a persistent world
from seeded noise and reusable systems. A dynamic day-and-night cycle changes the sky, fog,
lighting, shadows, stars, moon and the glow of nocturnal elements.

### Status

Fairytown is an evolving creative-development project. Its procedural systems,
performance architecture and atmosphere are in place, while art direction,
sound design, landmarks and final asset selection continue to develop.


## Inspiration

The project began after discovering Jeff Beene's
[SynthCity](https://jeff-beene.com/portfolio/synthcity/), an infinite procedural
cyberpunk city made with Three.js.

The goal is not to reproduce SynthCity, but to explore
how similar procedural principles can create something organic, whimsical and
quietly magical.

## Highlights

- Seeded, chunk-based open-world generation and streaming.
- Procedural terrain with hills, valleys, biome blending and water bodies.
- Noise-driven vegetation density and natural asset clustering.
- Multiple nature biomes plus recurring fairy villages.
- Fairy-style first-person flight with terrain-aware height limits.
- Dynamic sun, moon, stars, fog, shadows and time-of-day lighting.
- Distance-based population, incremental generation and asset instancing.
- Selective nighttime bloom, SSAO and a custom `.cube` color LUT.
- An accessible loading experience with progress feedback and controls.
- Debug-only performance, lighting and postprocessing tools at `/debug`.



## Controls

| Action | Input |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Look | Mouse |
| Rise | `Space` |
| Descend | `C` |
| Boost | `Shift` |

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use `/debug` to access the development
controls and performance panels.

## Production Build

```bash
npm run build
npm run preview
```

## Technology

- Three.js
- JavaScript
- GLSL and Three.js postprocessing
- Vite
- HTML and CSS


