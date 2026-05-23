# Unit Distance Wallpaper

A static GitHub Pages app for generating phone wallpapers from the lattice
`Z[zeta_12]` in the complex numbers.

```text
rho = exp(pi i / 3) = zeta_6
Z[zeta_12] = Z[i, rho]
```

The plotted points come from

```text
z = a + bi + c rho + d i rho
```

with integer `a, b, c, d` and the two disk constraints:

```text
|a + bi + c rho + d i rho| < R
|a - bi + c rho - d i rho| < R
```

The default `R = 4`, `rho = zeta_6` construction has 865 points and 3588 unit
edges. Every pair of points exactly one unit apart is drawn as a line, and every
point is drawn as a dot.

The root controls let you replace `rho` with primitive roots `zeta_m^k`. The
app always plots the same four-coefficient set `a + bi + c rho + d i rho`.
For generated orders above 12 this is a rank-four slice of `Z[i, rho]`, not the
entire ring of integers.

## Use

Open `index.html` in a browser, or serve the folder with any static web server.

The app lets you adjust:

- graph radius
- primitive root of unity used for `rho`
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
