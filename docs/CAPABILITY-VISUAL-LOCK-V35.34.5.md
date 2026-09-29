# V35.34.5 Capability Visual Lock

## Source of truth
The approved production composition is the V35.30.17/V35.30.6 balance:

- overhead horizontal gold beam;
- Product and Service suspended below it by vertical cables;
- circular registration joints on the beam;
- centred registration diamond;
- centred fulcrum/crosshair and shield;
- central vertical datum;
- two-triangle pedestal created by the production cascade;
- THE VESTIGE STANDARD registered beneath the fulcrum.

The production appearance is not to be redesigned for narrow screens.

## Responsive architecture
The complete diagram is one standalone SVG asset:

`public/assets/vestige-capability-scale-v35.34.5.svg`

The page embeds that asset as one `<img>`. Therefore:

- the website layout engine sizes one object;
- every internal component shares one SVG user-space;
- internal geometry cannot drift because of CSS Grid/Flexbox;
- desktop and mobile use the same composition;
- `viewBox` + `preserveAspectRatio="xMidYMid meet"` provide uniform scaling;
- SVG strokes are allowed to scale proportionally with the artwork.

## Accessibility
The page `<img>` has descriptive `alt` text.
The SVG file also contains `<title>` and `<desc>` for direct viewing.

## Governance
Future responsive work may resize the outer image but must not change the internal coordinates without explicit owner approval.
`npm run capability:check` enforces the locked production relationships.
