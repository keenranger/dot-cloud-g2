# Lens MCP for G2 release artwork

Original icon and cover prepared 2026-10-23. No third-party logo, product photograph or official-brand mark is included.

- icon-24.png: 24x24 RGBA PNG, only opaque #F4F4F4 or transparent pixels; 368 lit pixels. Every lit pixel is part of a raster-consumed 2x2 block. Official evenhub update validation passed and icon was saved to the Private draft.
- icon.svg and icon-grid.json: original editable pixel source. icon-preview.png is a nearest-neighbour inspection preview, not the store upload.
- cover.svg / cover-1600x900.png: original monochrome 16:9 promotional cover. This is artwork, not a device screenshot or physical verification. The observed portal editor generates its cover from uploaded screenshots and a portal environment; no custom cover file input is exposed there.
- screenshot-first-run.png: unchanged official simulator 0.9.5 RGBA framebuffer capture of the actual uploaded 0.4.1 build; 576x288. Glyphs are encoded in alpha with green RGB. Preserve alpha; it is a genuine simulator image, not proof of physical G2 display, BLE latency or locked-phone behavior. No private conversation, key or pairing code appears.

Official requirements checked: https://hub.evenrealities.com/docs/cli/apps and https://hub.evenrealities.com/docs/build/design-guidelines . The authenticated portal explicitly requests screenshots at 576x288 PNG.

Screenshot portal upload did not execute: the existing ChatGPT Chrome extension lacks Allow access to file URLs. No permission was enabled and no alternate route was used to bypass it. User can either upload screenshot-first-run.png manually with the existing portal, or grant that extension setting and ask the agent to resume. Select a supplied environment to generate the portal cover, then Confirm. The original cover remains available separately.
