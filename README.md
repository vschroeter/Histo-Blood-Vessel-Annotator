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

Morphometric parameters are derived from the manually traced polygons and thickness lines. Let $s$ be the spatial calibration in µm/pixel (`micrometerPerPixel`), applied per image. Polygon vertices $(x_i, y_i)$ for $i = 1,\ldots,n$ are treated as a closed contour with $(x_{n+1}, y_{n+1}) = (x_1, y_1)$.

The **outer vessel** polygon is the contour with larger area; the **inner lumen** polygon is the smaller. Their pixel areas come from the shoelace formula:

$$
A = \frac{1}{2}\left\lvert \sum_{i=1}^{n} \bigl( x_i y_{i+1} - y_i x_{i+1} \bigr) \right\rvert
$$

Write $A_{\mathrm{vessel}}$ and $A_{\mathrm{lumen}}$ for those areas. The outer vessel **perimeter** $P_{\mathrm{vessel}}$ is the sum of edge lengths along the outer contour:

$$
P_{\mathrm{vessel}} = \sum_{i=1}^{n} \sqrt{(x_{i+1}-x_i)^2 + (y_{i+1}-y_i)^2}
$$

The cross-sectional **wall area** (unchanged by the circularization below) is

$$
A_{\mathrm{wall}} = A_{\mathrm{vessel}} - A_{\mathrm{lumen}}.
$$

### Area-based wall-to-lumen ratio (annotated cross-section)

From the traced contours alone, the area-based wall-to-lumen ratio is

$$
(W/L)_{\mathrm{area}} = \frac{A_{\mathrm{vessel}} - A_{\mathrm{lumen}}}{A_{\mathrm{lumen}}} = \frac{A_{\mathrm{wall}}}{A_{\mathrm{lumen}}}.
$$

This quantity is defined for any cross-sectional shape. Vessel deformation or collapse during tissue preparation can strongly change the measured lumen area and therefore this ratio. The application’s primary wall-to-lumen endpoint uses the circularized reconstruction in the next section instead.

### Circularized vessel cross-section

To account for non-circular or collapsed profiles, an **equivalent circular** cross-section is built from the annotated outer vessel perimeter. The outer perimeter is assumed to approximate the undeformed vessel circumference (the traced contour is treated as sufficiently smooth aside from minor local irregularities). **Perimeter is conserved:**

$$
D^{\circ}_{\mathrm{vessel}} = \frac{P_{\mathrm{vessel}}}{\pi}, \qquad
A^{\circ}_{\mathrm{vessel}} = \pi \left(\frac{D^{\circ}_{\mathrm{vessel}}}{2}\right)^{2}.
$$

**Wall cross-sectional area is conserved** between the annotated profile and the reconstruction, so $A_{\mathrm{wall}}$ from the polygons is used directly. The circularized lumen area and diameter are

$$
A^{\circ}_{\mathrm{lumen}} = A^{\circ}_{\mathrm{vessel}} - A_{\mathrm{wall}}, \qquad
D^{\circ}_{\mathrm{lumen}} = 2 \sqrt{\frac{A^{\circ}_{\mathrm{lumen}}}{\pi}}.
$$

Internally, radii $`R^{\circ}_{\mathrm{vessel}} = P_{\mathrm{vessel}}/(2\pi)`$ and $`R^{\circ}_{\mathrm{lumen}} = \sqrt{A^{\circ}_{\mathrm{lumen}}/\pi}`$ are equivalent.

### Circularized wall-to-lumen ratio (reported)

The **media–lumen ratio** shown in the UI and CSV is the circularized area-based wall-to-lumen ratio:

$$
(W/L)^{\circ}_{\mathrm{area}} = \frac{A^{\circ}_{\mathrm{vessel}} - A^{\circ}_{\mathrm{lumen}}}{A^{\circ}_{\mathrm{lumen}}} = \frac{A_{\mathrm{wall}}}{A^{\circ}_{\mathrm{lumen}}}.
$$

### Circularized mean wall thickness (reported)

Mean wall thickness of the reconstructed circular profile is

$$
\overline{t}^{\circ}_{\mathrm{wall}} = \frac{D^{\circ}_{\mathrm{vessel}} - D^{\circ}_{\mathrm{lumen}}}{2}
$$

in pixels; the value in micrometres is $\overline{t}^{\circ}_{\mathrm{wall}} \cdot s$.

### Wall-thickness variability ratio (reported)

Thickness lines from $(x_1, y_1)$ to $(x_2, y_2)$ have length $L = \sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$. Let $L_{\max}$ and $L_{\min}$ be the longest and shortest line lengths among all intercepts (in µm, $L \cdot s$). The **wall-thickness variability ratio** is

$$
R_{\mathrm{WT}} = \frac{L_{\max}}{L_{\min}}.
$$


### Derived diameters (side panel)

Reconstructed outer and inner diameters in micrometres:

$$
D^{\circ}_{\mathrm{vessel},\,\mu\mathrm{m}} = D^{\circ}_{\mathrm{vessel}} \cdot s, \qquad
D^{\circ}_{\mathrm{lumen},\,\mu\mathrm{m}} = D^{\circ}_{\mathrm{lumen}} \cdot s.
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
