# FarozSyakir.github.io

My personal portfolio, built as a small walk-through game. Press **Start** and a
character walks from Jakarta to Nanjing and on to each project, or switch to
**Page view** for a plain, scrollable version. One static site, no build step,
no framework.

**Live:** https://farozsyakir.github.io

## How it works
- The scene is drawn on a `<canvas>` in a 2.5D perspective: the ground is a
  top-down texture squeezed into the distance, and everything on it is a flat
  pixel sprite in a depth lane, so nearer lanes scroll faster.
- Every sprite and building is drawn in code from pixel data — no image files.
- Day and night are palette swaps that follow the visitor's light/dark setting.
- Page view holds the same content as plain HTML, so it works with the keyboard,
  with a screen reader, and when `prefers-reduced-motion` is on.

## Project structure
```
index.html              markup + a tiny inline script that picks the first screen
css/styles.css          all styles, plus the two self-hosted pixel fonts
js/main.js              the game (canvas, sprites, walking) and the page logic
assets/fonts/           Press Start 2P and Pixelify Sans (OFL), self-hosted
```

## Running locally
It's plain static files, so any static server works:
```bash
python3 -m http.server
```
Then open http://localhost:8000.

## Fonts
Press Start 2P and Pixelify Sans, both under the SIL Open Font License.

## Author
Faroz Syakir (法明轩) — Software Engineering student, Nanjing Xiaozhuang University.
