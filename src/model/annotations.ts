import Konva from 'konva';
import mitt from 'mitt';
import { type PointLike, Point } from '2d-geometry';
import { useGlobalStore } from 'src/stores/global-store';
import type { Raw } from 'vue';
import { markRaw } from 'vue';

type ImageAnnotationEvents = { update: undefined };

export const DEFAULT_MICROMETER_PER_PIXEL = 0.36;

export interface Renderable {
  render(layer: Konva.Layer): Konva.Shape;
}

type AddPointResult = 'added' | 'complete' | 'ignored';

export abstract class Annotation implements Renderable {
  color: string = 'black';
  parent: ImageAnnotation;
  hoveredPoint?: Point | undefined;
  type: 'polygon' | 'line' = 'polygon';
  points: Point[] = [];

  constructor(parent: ImageAnnotation) {
    this.parent = parent;
  }

  abstract render(layer: Konva.Layer): Konva.Shape;

  /** Add a vertex. Returns whether the annotation is still open, finished, or ignored. */
  abstract addPoint(point: PointLike): AddPointResult;

  abstract removeLastPoint(): void;

  finalizePoints(): void {
    // Lines are complete after two points; polygons simplify on finish.
  }

  loadJSON(ann: { points: PointLike[]; color: string }) {
    this.points = ann.points.map((pt) => new Point(pt.x, pt.y));
    this.color = ann.color;
  }
}

export class LineAnnotation extends Annotation {
  get start(): Point | undefined {
    return this.points[0];
  }
  set start(point: Point) {
    if (!this.points[0]) {
      this.points.push(point);
    } else {
      this.points[0] = point;
    }
  }

  get end(): Point | undefined {
    return this.points[1];
  }
  set end(point: Point) {
    if (!this.points[1]) {
      this.points.push(point);
    } else {
      this.points[1] = point;
    }
  }

  get length(): number {
    if (!this.start || !this.end) return 0;
    return Math.hypot(this.start.x - this.end.x, this.start.y - this.end.y);
  }

  constructor(parent: ImageAnnotation) {
    super(parent);
    this.color = 'yellow';
    this.type = 'line';
  }

  render(layer: Konva.Layer): Konva.Shape {
    if (!this.start) return new Konva.Line();

    const points: number[] = [];
    points.push(this.start.x, this.start.y);
    if (this.end) {
      points.push(this.end.x, this.end.y);
    }
    if (this.hoveredPoint) {
      points.push(this.hoveredPoint.x, this.hoveredPoint.y);
    }

    const line = new Konva.Line({
      points,
      stroke: this.color,
      strokeWidth: 12,
    });
    layer.add(line);
    return line;
  }

  addPoint(point: PointLike): AddPointResult {
    if (!this.start) {
      this.start = new Point(point.x, point.y);
      return 'added';
    }
    if (!this.end) {
      this.end = new Point(point.x, point.y);
      return 'complete';
    }
    return 'ignored';
  }

  removeLastPoint(): void {
    if (this.points.length === 0) return;
    this.points = this.points.slice(0, -1);
  }
}

export class PolygonAnnotation extends Annotation {
  areaPixel: number = 0;

  override loadJSON(ann: { points: PointLike[]; color: string }) {
    super.loadJSON(ann);
    this.calculateArea();
  }

  constructor(parent: ImageAnnotation) {
    super(parent);
    this.color = 'blue';
    this.type = 'polygon';
  }

  render(layer: Konva.Layer): Konva.Shape {
    const combinedPoints = this.getCombinedPoints();
    const flat = combinedPoints.reduce((acc, pt) => acc.concat([pt.x, pt.y]), [] as number[]);

    if (flat.length >= 2) {
      if (this.hoveredPoint) {
        flat.push(this.hoveredPoint.x, this.hoveredPoint.y);
      }
      flat.push(flat[0]!, flat[1]!);
    }

    const polygon = new Konva.Line({
      points: flat,
      stroke: this.color,
      strokeWidth: 4,
      lineCap: 'round',
      lineJoin: 'round',
    });
    layer.add(polygon);
    return polygon;
  }

  private calculateArea(): void {
    if (this.points.length < 3) {
      this.areaPixel = 0;
      return;
    }
    let sum = 0;
    for (let i = 0; i < this.points.length; i++) {
      const cur = this.points[i]!;
      const next = this.points[(i + 1) % this.points.length]!;
      sum += cur.x * next.y - cur.y * next.x;
    }
    this.areaPixel = Math.abs(sum / 2);
  }

  get areaInMicroSquared(): number {
    const mpp = this.parent ? this.parent.micrometerPerPixel : 1;
    return this.areaPixel * (mpp ** 2);
  }

  get circumferenceBasedOnLength(): number {
    if (this.points.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < this.points.length; i++) {
      const current = this.points[i]!;
      const next = this.points[(i + 1) % this.points.length]!;
      sum += Math.hypot(next.x - current.x, next.y - current.y);
    }
    return sum;
  }

  get circumferenceBasedOnArea(): number {
    const r = Math.sqrt(this.areaPixel / Math.PI);
    return 2 * Math.PI * r;
  }

  get diameterBasedOnArea(): number {
    return this.circumferenceBasedOnArea / Math.PI;
  }

  private perpendicularDistance(pt: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
    }
    const numerator = Math.abs(dy * pt.x - dx * pt.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
    const denominator = Math.hypot(dx, dy);
    return numerator / denominator;
  }

  private rdp(points: Point[], tol: number): Point[] {
    if (points.length < 3) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const d = this.perpendicularDistance(points[i]!, points[0]!, points[end]!);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > tol) {
      const recResults1 = this.rdp(points.slice(0, index + 1), tol);
      const recResults2 = this.rdp(points.slice(index, points.length), tol);
      return recResults1.slice(0, -1).concat(recResults2);
    }
    return [points[0]!, points[end]!];
  }

  getCombinedPoints(points: Point[] = this.points): Point[] {
    if (points.length < 3) return points;
    const epsilon = 3;
    const last = points[points.length - 1]!;
    const combined = this.rdp(points.slice(0, -1), epsilon);
    return combined.concat([last]);
  }

  addPoint(point: PointLike): AddPointResult {
    this.points.push(new Point(point.x, point.y));
    this.calculateArea();
    return 'added';
  }

  removeLastPoint(): void {
    this.points = this.points.slice(0, -1);
    this.calculateArea();
  }

  override finalizePoints(): void {
    this.points = this.getCombinedPoints();
    this.calculateArea();
  }
}

export class ImageAnnotation {
  static lastMicrometerPerPixel: number = DEFAULT_MICROMETER_PER_PIXEL;

  filePath?: string | undefined;

  private _micrometerPerPixel?: number;
  get micrometerPerPixel(): number {
    return this._micrometerPerPixel ?? DEFAULT_MICROMETER_PER_PIXEL;
  }
  set micrometerPerPixel(val: number | undefined) {
    if (val !== undefined) {
      this._micrometerPerPixel = val;
      ImageAnnotation.lastMicrometerPerPixel = val;
    }
  }

  annotations: Annotation[] = [];
  selectedAnnotation?: Annotation | undefined;
  store = markRaw(useGlobalStore());
  layer?: Raw<Konva.Layer>;
  private emitter = mitt<ImageAnnotationEvents>();

  constructor() {
    this.micrometerPerPixel = ImageAnnotation.lastMicrometerPerPixel;
  }

  onUpdate(handler: () => void): () => void {
    const proxy = () => handler();
    this.emitter.on('update', proxy);
    return () => this.emitter.off('update', proxy);
  }

  private emitUpdate(): void {
    this.emitter.emit('update');
  }

  get polygonAnnotations(): PolygonAnnotation[] {
    return this.annotations.filter((ann) => ann instanceof PolygonAnnotation);
  }

  get lineAnnotations(): LineAnnotation[] {
    return this.annotations.filter((ann) => ann instanceof LineAnnotation);
  }

  rightClickPoint(_point: PointLike): void {
    if (this.selectedAnnotation) {
      this.selectedAnnotation.removeLastPoint();

      if (this.selectedAnnotation.points.length === 0) {
        this.annotations = this.annotations.filter((ann) => ann !== this.selectedAnnotation);
        this.selectedAnnotation = undefined;
      }

      this.redrawAnnotations();
      this.emitUpdate();
    }
  }

  clickPoint(point: PointLike): void {
    if (!this.selectedAnnotation) {
      const tool = this.store.currentTool;
      if (tool === 'line') {
        this.selectedAnnotation = new LineAnnotation(this);
        this.annotations.push(this.selectedAnnotation);
        this.emitUpdate();
      } else if (tool === 'polygon') {
        this.selectedAnnotation = new PolygonAnnotation(this);
        this.annotations.push(this.selectedAnnotation);
        this.emitUpdate();
      }
    }
    if (this.selectedAnnotation) {
      const res = this.selectedAnnotation.addPoint(point);
      if (res === 'complete') {
        this.selectedAnnotation = undefined;
        this.emitUpdate();
      } else if (res === 'added') {
        this.emitUpdate();
      }
    }
    this.redrawAnnotations();
  }

  removeAnnotation(annotation: Annotation): void {
    this.annotations = this.annotations.filter((ann) => ann !== annotation);
    this.redrawAnnotations();
    this.emitUpdate();
  }

  sortAnnotations(): void {
    this.annotations.sort((a, b) => {
      if (a instanceof PolygonAnnotation && b instanceof PolygonAnnotation) {
        return b.areaPixel - a.areaPixel;
      }
      if (a instanceof LineAnnotation && b instanceof LineAnnotation) {
        return b.length - a.length;
      }
      return 0;
    });
  }

  processKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.selectedAnnotation) {
        this.removeAnnotation(this.selectedAnnotation);
        this.selectedAnnotation = undefined;
      }
    }

    if (event.key === 'Enter') {
      if (this.selectedAnnotation) {
        this.selectedAnnotation.hoveredPoint = undefined;
        this.selectedAnnotation.finalizePoints();
        this.selectedAnnotation = undefined;
        this.store.currentTool = null;
        this.sortAnnotations();
        this.emitUpdate();
      }
    }

    this.redrawAnnotations();
  }

  hoverPoint(point: PointLike): void {
    if (this.selectedAnnotation) {
      this.selectedAnnotation.hoveredPoint = new Point(point.x, point.y);
      this.redrawAnnotations();
    }
  }

  redrawAnnotations(): void {
    if (this.layer) {
      this.layer.destroyChildren();
      this.annotations.forEach((ann) => ann.render(this.layer!));
    }
  }

  toJSON(): string {
    return JSON.stringify({
      filePath: this.filePath,
      micrometerPerPixel: this.micrometerPerPixel,
      annotations: this.annotations.map((ann) => ({
        points: ann.points,
        color: ann.color,
        type: ann.type,
      })),
    });
  }

  static fromJSON(json: string): ImageAnnotation {
    const imageAnn = new ImageAnnotation();
    try {
      const data = JSON.parse(json) as {
        filePath?: string | undefined;
        micrometerPerPixel?: number;
        annotations?: Array<{ points: PointLike[]; color: string; type?: string }>;
      };
      imageAnn.filePath = data.filePath;
      imageAnn.micrometerPerPixel = data.micrometerPerPixel;
      imageAnn.annotations = (data.annotations ?? []).map((ann) => {
        const loaded =
          (ann.type ?? 'polygon') === 'polygon'
            ? new PolygonAnnotation(imageAnn)
            : new LineAnnotation(imageAnn);
        loaded.loadJSON(ann);
        return loaded;
      });
    } catch (error) {
      console.error('Error parsing annotations:', error);
    }
    return imageAnn;
  }

  get biggestPolygonAnnotation(): PolygonAnnotation | undefined {
    return this.polygonAnnotations.length > 0
      ? this.polygonAnnotations.reduce((largest, ann) =>
          ann.areaPixel > largest.areaPixel ? ann : largest,
        )
      : undefined;
  }

  get smallestPolygonAnnotation(): PolygonAnnotation | undefined {
    return this.polygonAnnotations.length > 0
      ? this.polygonAnnotations.reduce((smallest, ann) =>
          ann.areaPixel < smallest.areaPixel ? ann : smallest,
        )
      : undefined;
  }

  get outerCircumference(): number {
    const biggest = this.biggestPolygonAnnotation;
    return biggest ? biggest.circumferenceBasedOnLength : 0;
  }

  get wallAreaPixel(): number {
    if (!this.biggestPolygonAnnotation || !this.smallestPolygonAnnotation || this.annotations.length < 2) {
      return 0;
    }
    return this.biggestPolygonAnnotation.areaPixel - this.smallestPolygonAnnotation.areaPixel;
  }

  get outerCircleAreaCalculated(): number {
    if (!this.biggestPolygonAnnotation || !this.smallestPolygonAnnotation || this.annotations.length < 2) {
      return 0;
    }
    const outerCircleRadius = this.outerCircumference / (2 * Math.PI);
    return Math.PI * outerCircleRadius * outerCircleRadius;
  }

  get outerCircleAreaCalculatedInMicroSquared(): number {
    return this.outerCircleAreaCalculated * this.micrometerPerPixel ** 2;
  }

  get outerCircleDiameterBasedOnCalculatedArea(): number {
    return Math.sqrt(this.outerCircleAreaCalculated / Math.PI) * 2;
  }

  get averageWallThickness(): number {
    if (!this.biggestPolygonAnnotation || !this.smallestPolygonAnnotation || this.annotations.length < 2) {
      return 0;
    }
    const outerCircleRadius = this.outerCircumference / (2 * Math.PI);
    const innerArea = this.outerCircleAreaCalculated - this.wallAreaPixel;
    const innerCircleRadius = Math.sqrt(innerArea / Math.PI);
    return outerCircleRadius - innerCircleRadius;
  }

  get averageWallThicknessInMicro(): number {
    return this.averageWallThickness * this.micrometerPerPixel;
  }

  get innerAreaCalculated(): number {
    if (!this.biggestPolygonAnnotation || !this.smallestPolygonAnnotation || this.annotations.length < 2) {
      return 0;
    }
    const outerCircleRadius = this.outerCircleDiameterBasedOnCalculatedArea / 2;
    const innerCircleRadius = outerCircleRadius - this.averageWallThickness;
    return Math.PI * innerCircleRadius * innerCircleRadius;
  }

  get innerAreaCalculatedInMicroSquared(): number {
    return this.innerAreaCalculated * this.micrometerPerPixel ** 2;
  }

  get mediaLumenRatio(): number {
    const lumenArea = this.innerAreaCalculated;
    const outerArea = this.outerCircleAreaCalculated;
    if (lumenArea === 0) return 0;
    return (outerArea - lumenArea) / lumenArea;
  }

  get outerCalculatedDiameterInMicro(): number {
    return Math.sqrt(this.outerCircleAreaCalculatedInMicroSquared / Math.PI) * 2;
  }

  get innerCalculatedDiameterInMicro(): number {
    return Math.sqrt(this.innerAreaCalculatedInMicroSquared / Math.PI) * 2;
  }

  get shortestLineAnnotation(): LineAnnotation | undefined {
    return this.lineAnnotations.length > 0
      ? this.lineAnnotations.reduce((shortest, ann) =>
          ann.length > 0 && ann.length < shortest.length ? ann : shortest,
        )
      : undefined;
  }

  get shortestLineAnnotationLength(): number {
    return (this.shortestLineAnnotation?.length ?? 0) * this.micrometerPerPixel;
  }

  get longestLineAnnotation(): LineAnnotation | undefined {
    return this.lineAnnotations.length > 0
      ? this.lineAnnotations.reduce((longest, ann) =>
          ann.length > 0 && ann.length > longest.length ? ann : longest,
        )
      : undefined;
  }

  get longestLineAnnotationLength(): number {
    return (this.longestLineAnnotation?.length ?? 0) * this.micrometerPerPixel;
  }

  get wallThicknessVariability(): number {
    if (!this.shortestLineAnnotation || !this.longestLineAnnotation) return 0;
    return this.longestLineAnnotationLength / this.shortestLineAnnotationLength;
  }
}
