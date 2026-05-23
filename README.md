# Unit Distance Wallpaper

A static GitHub Pages app for generating phone wallpapers from full cyclotomic
integer rings.

```text
rho = exp(pi i / 3) = zeta_6
N = lcm(4, 6) = 12
O_K = Z[zeta_N]
```

The plotted points come from

```text
x = n0 + n1 zeta_N + ... + n_{phi(N)-1} zeta_N^{phi(N)-1}
```

with integer coefficients. The app intersects the full Minkowski embedding with
a polydisc:

```text
|sigma_s(x)| < R for every s with gcd(s, N) = 1
```

The default `R = 4`, `rho = zeta_6` construction has 865 points and 3588 unit
edges. Every pair of points exactly one unit apart is drawn as a line, and every
point is drawn as a dot.

The root controls let you replace `rho` with primitive roots `zeta_m^k`. For
each choice the app uses the full ring `Z[zeta_N]`, where `N = lcm(4, m)`, so
the coefficient count changes with `phi(N)`.

## Use

Open `index.html` in a browser, or serve the folder with any static web server.

The app lets you adjust:

- graph radius
- coefficient range for every basis coefficient
- primitive root of unity used for `rho`
- maximum point count, to keep dense angle choices responsive
- point, line, and background colors
- dot and line pixel sizes
- centered viewport width and zoom
- export resolutions, including a custom phone size

When the root order changes, the coefficient range is reset based on the ring
rank: rank 4 or lower uses `-4..4`, and higher ranks use `-1..1` by default.
You can still override the range manually.

Exports are rendered as exact-size PNG links in the browser. The viewport is always centered on `(0, 0)`.

## GitHub Pages

1. Push this repo to GitHub.
2. In the repository settings, open **Pages**.
3. Set the source to deploy from the main branch root.
4. Open the published Pages URL.

No build step is required.
