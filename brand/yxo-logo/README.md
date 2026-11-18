# YXO logo (direction A: the 10× X)

Tagline: **Your Extraordinary Opportunity.** Every file is drawn from the same shapes, and the tagline is converted to outlines, so nothing depends on a font being installed.

## Which file

| You need | Use |
| --- | --- |
| Logo on navy, photos or other dark backgrounds | `yxo-logo-dark-bg` |
| Logo on white, cream or printed paper | `yxo-logo-light-bg` (print-safe colours) |
| One ink only (stamps, embroidery, engraving, fax) | `yxo-logo-navy`, or `yxo-logo-white` on a dark or coloured background |
| Wide spaces: website header, email signature, letterhead | `yxo-lockup-*` (logo beside the tagline) |
| Small spaces where the tagline would be unreadable | `yxo-wordmark-*` (no tagline) |
| Icon on its own: stickers, merch, watermark | `yxo-mark-*` (the X) |
| App icon | `yxo-app-icon` |
| Instagram, LinkedIn and other profile pictures | `yxo-social-avatar.png` (square; the platform crops it to a circle) |
| Website tab icon | `favicon.ico`, `favicon.svg`, `apple-touch-icon.png` |

`svg/` holds the master files: use them for print, signage and anything that gets scaled. `png/` holds transparent PNGs (the app icon, social avatar and favicons sit on a navy tile). The number in a PNG's name is its width in pixels.

## Rules

- The X's back stroke always matches the letters. Only the rising stroke (lower left to upper right) carries colour.
- On white or paper, use the `light-bg` files. The `dark-bg` gradient (mint, lime, yellow) washes out on paper.
- Leave clear space around the logo at least as wide as the O's stroke.
- Don't stretch it, recolour single letters, or set the tagline in another font.

## Colours

| | Hex |
| --- | --- |
| Navy | `#0C1140` |
| Cream | `#F6F2EA` |
| Rising stroke on dark | `#33E9A6` → `#BDF542` → `#FFE84A` |
| Rising stroke on light / print | `#0B7A72` → `#14B8A9` |

CMYK and Pantone values still need to be set with the printer before the first print run.
