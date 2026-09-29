# Vestige Responsive Governance â€” V35.34.0

## Authoritative approach
V35.34.0 is a direct source migration from the V35.30.19 production baseline.

The V35.31.0â€“V35.33.0 application scripts were copied into the project but were never executed against the live source tree. They are therefore not part of the source history or active website.

## Rules
1. Narrow/medium layouts must reflow rather than preserve desktop tracks.
2. The page must not rely on `overflow-x:hidden` to hide layout defects.
3. Whole-page or component `transform:scale()` is not a responsive strategy.
4. Media must be intrinsically fluid.
5. Flexible Grid/Flex children must be shrinkable.
6. Tables remain semantic tables; content wraps inside available width.
7. Diagrammatic graphics that must preserve internal geometry use one SVG viewBox.
8. `public/responsive-system.css` is the reusable cross-site responsive system.
9. Component-specific structural rules remain in their owning source stylesheet.

## Discover Vestige
Base state: one reading column.
Desktop editorial split: introduced only at `min-width:1200px`.

## Capability visual
The Product Delivery / Service Delivery visual is one SVG coordinate system using:
- `viewBox="0 0 1000 980"`
- `preserveAspectRatio="xMidYMid meet"`
- `width:100%`
- automatic proportional height

## Release gate
Before preview:
- `npm run check`
- `npm run clean:check`
- `npm run dry-run`

Before production:
- mobile visual review at 320 / 360 / 390 / 400 / 412 / 480 CSS px
- tablet review at 768 / 1024
- desktop review
- explicit owner production approval
