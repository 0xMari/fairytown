# Fairytown

An explorable procedural fairy-world built with Three.js and Vite.

Originally created as a visual and interactive experimentation space to explore procedural environments, atmosphere, and immersive storytelling, Fairytown is an ongoing work-in-progress focused on building dreamy and immersive 3D experiences directly in the browser.

## Explore the World

Main experience:  
https://fairytown.vercel.app

Debug / technical GUI version:  
https://fairytown.vercel.app/debug

The `/debug` route exposes development and technical GUI controls useful for exploring lighting, world parameters, atmosphere tuning, and environment behaviors.

## Current Features

- Three explorable biomes:
  - Meadow
  - Crystal Cave
  - Forest / Mushroom Kingdom
- Infinite-ish chunk loading around the camera
- Fairy-style flying controls
- Dynamic day/night cycle
- Ambient particles and environmental props
- Custom assets for:
  - trees
  - rocks
  - mushrooms
  - flowers
  - crystals
  - lanterns
- Placeholder loading screen (temporary)

## Tech Stack

- Three.js
- TypeScript
- Vite

## Planned Features

- Performance optimization across different devices
- Mobile-friendly navigation and controls
- Creatures and environmental interactions
- Improved atmosphere and cinematic color grading
- Sound design and ambient audio
- More biome variety and procedural generation improvements

## Notes

Some repetitive tasks and project cleanup workflows were assisted using Codex support tools during development.

## Included External Meadow Grass

The meadow biome currently uses grass assets adapted from  
[thebenezer/FluffyGrass](https://github.com/thebenezer/FluffyGrass)

Related files can be found in:

`public/fluffy-grass`

Meadow-specific world setup lives in:

`src/world/medow`
