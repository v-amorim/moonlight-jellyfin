# Moonlight for Jellyfin

A custom CSS theme for Jellyfin 10.11 in the [Moonlight palette][moonlight]. It is built for the LG webOS TV browser first and also covers PC and phone. Apart from the theme file itself, nothing loads from the internet: the Inter font is inlined.

## Install

1. Open **Dashboard > General > Custom CSS code**.
2. Put this line at the very top:

```css
@import url("https://cdn.jsdelivr.net/gh/v-amorim/moonlight-jellyfin@1/moonlight-jellyfin.css");
```

3. Save, then reload the web client. On a TV, close and reopen the Jellyfin page.

> [!WARNING]
> Remove or comment out any other theme's `@import` first. Two themes fight over the same selectors.

To roll back, comment out the line: `/* @import url("…"); */`. To turn the theme off on one device only, check **Settings > Display > Disable server-provided custom CSS** on that device.

### Optional script

A small script adds what CSS cannot do. Without it the theme works as before.

| Feature | Where |
| --- | --- |
| Episode list, Cast & Crew and Guest Stars as toggles that stay open or closed | Detail page |
| A faint clock with the remaining time while the controls are hidden, switched in the gear menu | Player |
| Hovering an episode or movie card scrubs its trickplay previews | PC |
| The menu close button is reachable with the arrow keys | TV |

1. Install the **JavaScript Injector** plugin from the [n00bcodr repository][injector] and restart the server.
2. Open **Dashboard > Plugins > JavaScript Injector** and add a script.
3. Paste the contents of [`script/moonlight-jellyfin.js`](script/moonlight-jellyfin.js), enable it and save. No restart is needed.

Paste the file again after each release, since the plugin keeps a copy.

## What it changes

| Area | Change |
| --- | --- |
| Colours | Moonlight tokens throughout; text on a primary fill is dark, never white |
| TV type | Body 18 px, titles 20, headings 36 and 40; the TV root size is pinned so these stay true pixels |
| Home | Section headers as caps on a hairline rule; seven posters per row on TV |
| Detail page (TV) | Series logo above a small title; action buttons as labelled tiles |
| Focus (TV) | A 3 px primary ring; the rest of the row dims |
| Player | An edge-to-edge seek bar with the times inside, chapter diamonds, a band of controls under it |
| Skip Intro / Outro | A primary button instead of stock cyan |
| Fixes | Stock cyan focus border on TV cards, clipped player titles on phones, the PC volume slider |

Layout changes apply to the TV layout only. PC and phone keep Jellyfin's own layout with the Moonlight colours, type and player.

## Compatibility

| Target | Notes |
| --- | --- |
| LG webOS 23 browser (Chromium 94) | No `:has()`, `oklch()`, nesting or `backdrop-filter`; `build.js` rejects them |
| PC and phone browsers | Tested at 1440 and 390 px wide |
| Jellyfin 10.11 | Built against 10.11.11 |

## Build

<details>
<summary>Rebuild the theme from src/</summary>

Each file in `src/` is one layer, joined in name order:

```sh
node build.js
```

The script inlines the Inter font from `vendor-font/` and fails if the result uses CSS that Chromium 94 lacks or references a network URL.

</details>

## License

[MIT](LICENSE). The bundled Inter font is under the [SIL Open Font License 1.1](vendor-font/OFL.txt).

[moonlight]: https://v-amorim.github.io/portfolio/blog/moonlight-palette/
[injector]: https://github.com/n00bcodr/Jellyfin-JavaScript-Injector
