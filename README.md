# Bath Designer

`/design` keeps the existing step flow, budget calculation, navigation, and result-page handoff. Its new layered preview lives in `components/BathroomPreview.tsx`: background, wall/floor tile, sink, toilet, shower, partition, jendai, faucet, mirror, accessory, and lighting.

Options (image, description, cost, and visual tile data) are centralized in `data/bathroom-options.ts`.

## Images

Option cards use `public/images/bathroom/option-placeholder.svg` until production photography is available. Add new assets to one of these folders, then set the option `image` field to that local path:

- `public/images/bathroom/backgrounds/`, `tiles/`, `sinks/`, `toilets/`, `partitions/`
- `public/images/bathroom/jendai/`, `faucets/`, `mirrors/`, `accessories/`

Example: `image: '/images/bathroom/tiles/tile-600x1200-warm-gray.jpg'`.
