# Unit Distance Wallpaper

A static GitHub Pages app for generating phone wallpapers from ring-of-integers
points in the number field

```text
K = Q(i, sqrt(D))
D squarefree, D = 1 mod 4
omega = (1 + sqrt(D)) / 2
O_K = Z[i, omega]
```

The plotted points come from

```text
x = a + bi + c omega + d i omega
```

with integer `a, b, c, d`. The app intersects the Minkowski embedding with a
polydisc:

```text
|sigma_1(x)| < R
|sigma_2(x)| < R
```

where `sigma_1(omega) = omega` and `sigma_2(omega) = (1 - sqrt(D)) / 2`.
The first complex embedding is projected to the plane. Every pair of projected
points exactly one unit apart is drawn as a line, and every projected point is
drawn as a dot.

## Use

Open `index.html` in a browser, or serve the folder with any static web server.

The app lets you adjust:

- graph radius
- number field parameter `D`
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
