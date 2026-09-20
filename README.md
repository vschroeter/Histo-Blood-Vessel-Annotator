# Image Annotator

Desktop application for morphometric annotation of H&E-stained histological sections of blood vessels.

The tool was developed to quantify vessel-wall geometry on TIFF microscopy images in support of a doctoral monograph. Its purpose is to obtain three morphometric endpoints from each vessel cross-section:

- **media–lumen ratio**
- **average wall thickness**
- **wall-thickness variability**

Annotation is entirely **manual**. There is no automated contour detection, segmentation, or measurement proposal. The observer traces the vessel wall and places thickness intercepts by hand; the application only stores those traces and evaluates the formulae below.

![Main window with file list, vessel image, and morphometric tables](docs/ScreenshotMain.jpg)

*Main window. Left: TIFF series with annotation status (green complete, orange incomplete, red missing). Centre: zoomable image canvas. Right: polygon and line measurements plus derived vessel metrics.*

![Detail of a vessel wall with polygon outlines and a thickness line](docs/Annotation.png)

*Annotation detail. Blue polygons follow the inner and outer media borders. The yellow line is a wall-thickness intercept.*

## Annotation process

Two drawing tools are provided. A vessel is considered complete when it has **two polygons** and **at least two lines**.

### Polygon annotations

Each vessel cross-section is outlined with exactly two closed polygons:

1. the **outer edge** of the media
2. the **inner edge** of the media (luminal border)

The larger polygon is treated as the outer contour and the smaller as the inner contour. Their areas, and the perimeter of the outer polygon, are the inputs to the media–lumen ratio and the average wall thickness.

To draw a polygon, select the polygon tool, then:

- left-click to place vertices along the border
- hold the right mouse button to trace densely
- press **Enter** to close the contour (vertices are then simplified with the Ramer–Douglas–Peucker algorithm)
- press **Escape** to discard the contour in progress

### Line annotations

The line tool places **orthogonal intercepts** across the media: two-point chords that should run locally perpendicular to the wall, from the inner to the outer border, at freely chosen positions around the circumference.

The application does not enforce perpendicularity; the observer is expected to place the intercepts orthogonally. Any number of intercepts may be drawn. Wall-thickness variability uses only the **longest** and the **shortest** of those lines.

A line is created with two left clicks (start and end).

### Canvas controls

- Mouse wheel zooms; drag pans; double-click resets the view.
- A spatial calibration in micrometres per pixel can be set per image (default `0.36`). The last used value is reused for newly opened files.

## Calculations

Let $s$ be the calibration in µm/pixel (`micrometerPerPixel`). Polygon vertices $(x_i, y_i)$ for $i = 1,\ldots,n$ are closed with $(x_{n+1}, y_{n+1}) = (x_1, y_1)$.

### Polygon area and outer circumference

Area is the shoelace formula:

$$
A = \frac{1}{2}\left\lvert \sum_{i=1}^{n} \bigl( x_i y_{i+1} - y_i x_{i+1} \bigr) \right\rvert
$$

The **outer** polygon is the one with larger area $A_{\mathrm{out}}$; the **inner** polygon has area $A_{\mathrm{in}}$. The outer circumference is the polygonal perimeter of the outer contour:

$$
C_{\mathrm{out}} = \sum_{i=1}^{n} \sqrt{(x_{i+1}-x_i)^2 + (y_{i+1}-y_i)^2}
$$

The measured media (wall) area in pixels is

$$
A_{\mathrm{wall}} = A_{\mathrm{out}} - A_{\mathrm{in}}
$$

### Idealized circular vessel

Folded or collapsed vessels are mapped to an equivalent circle that **preserves the outer circumference** and the **wall area** (the wall thickness is treated as uniform after this unfolding):

$$
R_{\mathrm{out}} = \frac{C_{\mathrm{out}}}{2\pi}, \qquad
A_{\mathrm{out}}^{\circ} = \pi R_{\mathrm{out}}^{2}
$$

$$
A_{\mathrm{in}}^{\circ} = A_{\mathrm{out}}^{\circ} - A_{\mathrm{wall}}, \qquad
R_{\mathrm{in}} = \sqrt{\frac{A_{\mathrm{in}}^{\circ}}{\pi}}
$$

### Average wall thickness

$$
t = R_{\mathrm{out}} - R_{\mathrm{in}}
$$

Reported in micrometres as $t_{\mu\mathrm{m}} = t \cdot s$.

### Media–lumen ratio

The media–lumen ratio is the equivalent-circle wall area divided by the equivalent-circle lumen area:

$$
\mathrm{MLR} = \frac{A_{\mathrm{out}}^{\circ} - A_{\mathrm{in}}^{\circ}}{A_{\mathrm{in}}^{\circ}} = \frac{A_{\mathrm{wall}}}{A_{\mathrm{in}}^{\circ}}
$$

### Wall-thickness variability

A line from $(x_1, y_1)$ to $(x_2, y_2)$ has Euclidean length $L = \sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$. Among all line annotations, let $L_{\max}$ and $L_{\min}$ be the longest and shortest (in micrometres, $L \cdot s$). Then

$$
\mathrm{WTV} = \frac{L_{\max}}{L_{\min}}
$$

### Derived diameters

The diameters shown in the side panel follow from the equivalent-circle areas, converted with $s$:

$$
D_{\mathrm{out}} = 2 R_{\mathrm{out}} \, s, \qquad
D_{\mathrm{in}} = 2 R_{\mathrm{in}} \, s
$$

## Typical workflow

1. Enter the folder that contains the TIFF images and choose **Load Files**.
2. Select an image. Existing annotations load automatically from `annotations/<filename>_annotations.json`.
3. Draw the outer and inner polygons, then at least two orthogonal intercepts.
4. Adjust **Micrometer Per Pixel** if the acquisition calibration differs from the default.
5. **Export Annotations** writes a semicolon-separated CSV (decimal comma) for spreadsheet software.

The file list is colour-coded: **complete** means at least two polygons and two lines, **incomplete** means some annotations exist, **missing** means none.

## Output files

Each annotated image gets a JSON sidecar:

```text
<folder>/annotations/<filename>_annotations.json
```

The file stores the calibration and a list of annotations (`type`: `polygon` or `line`) with vertex coordinates in image pixels.

The CSV export contains one row per annotated image:

`filename`, `sample_id`, `type` (`AA` or `MA` parsed from the file name), `microPerPixel`, `mediaLumenRatio`, `averageWallThicknessInMicro`, `outerCalculatedDiameterInMicro`, `innerCalculatedDiameterInMicro`, `wallThicknessVariability`, `shortestLineAnnotationLengthInMicro`, `longestLineAnnotationLengthInMicro`.

`sample_id` is the four-digit token in the file name; `type` is `AA` when the name contains `AA`, otherwise `MA`.

## Requirements

- Node.js 20 or later
- [pnpm](https://pnpm.io/) 10 or later
- Windows, macOS, or Linux (the published workflow was used on Windows)

## Development

```bash
pnpm install
pnpm dev
```

This starts the Electron app with hot reload. Native packages (`electron`, `sharp`, `esbuild`) must be allowed to run their install scripts; `package.json` lists them under `pnpm.onlyBuiltDependencies`. If an existing checkout skipped those scripts, run `pnpm rebuild` and then `pnpm dev` again.

```bash
pnpm lint
pnpm format
```

## Building a desktop executable

Build on the operating system you want to ship. Electron packaging is not reliably cross-compiled (a Windows `.exe` should be produced on Windows).

```bash
pnpm install
pnpm build
```

This runs Quasar in Electron mode and packages the app with [electron-builder](https://www.electron.build/). Installers and portable binaries land in `dist/electron/Packaged/`. An unpacked copy for inspection is written to `dist/electron/Unpacked/`.

On **Windows** the build produces two x64 artefacts:

| File | What it is |
| --- | --- |
| `Image Annotator-Setup-0.0.1.exe` | NSIS installer (user can choose the install directory) |
| `Image Annotator-Portable-0.0.1.exe` | Single-file portable app, no installation |

On **macOS** the build produces a `.dmg` (x64 and Apple Silicon). On **Linux** it produces an `.AppImage`.

Sharp (TIFF decoding) is unpacked from the asar archive so the packaged app can load `.tif` / `.tiff` files the same way as in development.

The version number in the file name comes from `package.json`. Bump `version` there before a release if you need a new filename.

## Architecture

The user interface is a [Quasar](https://quasar.dev/) / Vue 3 renderer. [Konva](https://konvajs.org/) draws the image and overlays. The Electron main process reads TIFF files with [sharp](https://sharp.pixelplumbing.com/), converts them to PNG for the canvas, and reads or writes annotation JSON on disk.

This repository is intended as a citable companion to the monograph. Analysis pipelines that consume the CSV/JSON output may include it as a Git submodule.

## Licence

MIT. See [LICENSE](LICENSE).
