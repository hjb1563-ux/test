# Bath Designer

`/design` keeps the existing step flow, budget calculation, navigation, and result-page handoff. Its new layered preview lives in `components/BathroomPreview.tsx`: background, wall/floor tile, sink, toilet, shower, partition, jendai, faucet, mirror, accessory, and lighting.

Options (image, description, cost, and visual tile data) are centralized in `data/bathroom-options.ts`.

## Images

Option cards use `public/images/bathroom/option-placeholder.svg` until production photography is available. Add new assets to one of these folders, then set the option `image` field to that local path:

- `public/images/bathroom/backgrounds/`, `tiles/`, `sinks/`, `toilets/`, `partitions/`
- `public/images/bathroom/jendai/`, `faucets/`, `mirrors/`, `accessories/`

Example: `image: '/images/bathroom/tiles/tile-600x1200-warm-gray.jpg'`.

## Remodeling guide

The guide catalog is managed by `data/guides/catalog.ts`, with shared types in `data/guides/types.ts`. It serves 16 beginner-friendly topics at `/guide/[slug]`, plus a searchable glossary at `/guide/glossary`.

Guide card and option imagery currently uses the safe local placeholder at `public/images/guide/guide-placeholder.svg`. Put future owned/licensed assets beneath `public/images/guide/` by category (`demolition/`, `structure/`, `waterproofing/`, `tiles/`, `basins/`, `toilets/`, `furniture/`, `bathtubs/`, `ceilings/`, `faucets/`, `drainage/`, `ventilation/`, `lighting/`, `accessories/`, `grout/`, or `threshold/`) and update the relevant `image` field in the guide data.

Some guide choices include an “내 욕실에 적용해보기” link. It passes the matching option to `/design` as a query parameter, where the existing configurator loads that selection.
