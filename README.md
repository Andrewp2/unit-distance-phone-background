# Unit Distance Wallpaper

A static GitHub Pages app for generating phone wallpapers from the point set

```text
z = a + bi + cp + dip
```

with integer `a, b, c, d` and the two open disk constraints:

```text
|z| < 4
|a - bi + cp - dip| < 4
```

Every pair of generated points exactly one unit apart is drawn as a line, and every generated point is drawn as a dot.

## Use

Open `index.html` in a browser, or serve the folder with any static web server.

The app lets you adjust:

- `p`, with a unit-circle angle control and direct `Re(p)` / `Im(p)` inputs
- graph radius
- maximum point count, to keep dense angle choices responsive
- point, line, and background colors
- dot and line pixel sizes
- centered viewport width and zoom
- export resolutions, including a custom phone size

Exports are rendered as exact-size PNG links in the browser. The viewport is always centered on `(0, 0)`.

## GitHub Pages

1. Push this repo to GitHub.
2. In the repository settings, open **Pages**.
3. Set the source to deploy from the main branch root.
4. Open the published Pages URL.

No build step is required.
