import Konva from 'konva';
import { type PointLike, Point } from "2d-geometry";
import { useGlobalStore } from 'src/stores/global-store';
import type { Raw } from 'vue';
import { markRaw, ref, type Ref } from 'vue';
import { useThrottleFn } from '@vueuse/core';

////////////////////////////////////////////////////////////////////////////
// #region Annotation classes
////////////////////////////////////////////////////////////////////////////

export interface Renderable {
  render(layer: Konva.Layer): Konva.Shape;
}

type AddPointResult = "added" | "complete" | "ignored";

export abstract class Annotation implements Renderable {

  color: string = 'black';

  hoveredPoint?: Point | undefined;

  points: Point[] = [];

  constructor() {
  }

  abstract render(layer: Konva.Layer): Konva.Shape;

  /**
   * Add a point to the annotation. Returns true if the annotation is complete.
   * @param point The point to add
   * @returns True if the annotation is complete
   */
  abstract addPoint(point: PointLike): AddPointResult;

  abstract removeLastPoint(): void;

}

// export class LineAnnotation extends Annotation {

//   start?: Point;
//   end?: Point;

//   constructor() {
//     super();
//     this.color = 'red';
//   }
//   render(layer: Konva.Layer): Konva.Shape {
//     const points = [this.start?.x, this.start?.y, this.end?.x, this.end?.y];
//     const filteredPoints = points.filter(p => p !== undefined);

//     if (filteredPoints.length == 2) {
//       if (this.hoveredPoint) {
//         filteredPoints.push(this.hoveredPoint.x, this.hoveredPoint.y);
//       }
//     }

//     const line = new Konva.Line({
//       points: filteredPoints,  // FIX: use "points" instead of "filteredPoints"
//       stroke: this.color,
//       strokeWidth: 2,
//       lineCap: 'round',
//       lineJoin: 'round',
//     });
//     layer.add(line);
//     return line;
//   }

//   addPoint(point: PointLike): AddPointResult {
//     if (!this.start) {
//       this.start = new Point(point.x, point.y);
//       return "added";
//     } else if (!this.end) {
//       this.end = new Point(point.x, point.y);
//       return "complete";
//     }
//     return "ignored";
//   }

// }

export class PolygonAnnotation extends Annotation {
  // New parent property to reference the ImageAnnotation instance
  parent?: ImageAnnotation;

  loadJSON(ann: any) {
    this.points = ann.points.map((pt: any) => new Point(pt.x, pt.y));
    this.color = ann.color;
    this.calculateArea();
  }
  // Add a reactive area property
  // area: Ref<number> = ref(0);
  area: number = 0;

  constructor() {
    super();
    this.color = 'blue';
  }
  render(layer: Konva.Layer): Konva.Shape {

    const combinedPoints = this.getCombinedPoints()

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
      // closed: true,
      lineCap: 'round',
      lineJoin: 'round',
    });

    // console.log('Rendering polygon', this, flat);

    layer.add(polygon);
    return polygon;
  }

  // Calculate area using the shoelace formula
  private calculateArea(): void {
    if (this.points.length < 3) {
      this.area = 0;
      return;
    }
    let sum = 0;
    for (let i = 0; i < this.points.length; i++) {
      const cur = this.points[i]!;
      const next = this.points[(i + 1) % this.points.length]!;
      sum += cur.x * next.y - cur.y * next.x;
    }
    this.area = Math.abs(sum / 2);
  }

  // Change areaInMicroSquared to use the parent's micrometerPerPixel property
  get areaInMicroSquared(): number {
    const mpp = this.parent ? this.parent.micrometerPerPixel ?? 1 : 1;
    return this.area * (mpp ** 2);
  }

  // New getter: Calculate circumference (closed polygon)
  get circumference(): number {
    if (this.points.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < this.points.length; i++) {
      const current = this.points[i]!;
      const next = this.points[(i + 1) % this.points.length]!;
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      sum += Math.hypot(dx, dy);
    }
    return sum;
  }

  // New getter: Diameter of a circle with the same circumference
  get diameter(): number {
    return this.circumference / Math.PI;
  }


  perpendicularDistance(pt: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
    }
    const numerator = Math.abs(dy * pt.x - dx * pt.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
    const denominator = Math.hypot(dx, dy);
    return numerator / denominator;
  }

  rdp(points: Point[], tol: number): Point[] {
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
    } else {
      return [points[0]!, points[end]!];
    }
  }

  getCombinedPoints(points: Point[] = this.points): Point[] {
    //
    if (points.length < 3) return points;
    const epsilon = 2; // adjust tolerance as needed

    // Kee the last point as it is
    const last = points[points.length - 1]!;

    const combined = this.rdp(points.slice(0, -1), epsilon);

    return combined.concat([last]);
  }

  combinePoints(): void {
    this.points = this.getCombinedPoints();
  }


  addPoint(point: PointLike): AddPointResult {
    this.points.push(new Point(point.x, point.y));

    this.calculateArea();
    console.log('Points:', this.points.length);
    return "added";
  }

  removeLastPoint(): void {
    this.points = this.points.slice(0, -1);
    this.calculateArea();
  }

}

////////////////////////////////////////////////////////////////////////////
// #region Image annotation
////////////////////////////////////////////////////////////////////////////

export class ImageAnnotation {
  static lastMicrometerPerPixel: number = 1; // default value

  filePath?: string;

  private _micrometerPerPixel?: number;
  get micrometerPerPixel() {
    return this._micrometerPerPixel;
  }
  set micrometerPerPixel(val: number | undefined) {
    if (val !== undefined) {
      this._micrometerPerPixel = val;
      ImageAnnotation.lastMicrometerPerPixel = val;
    }
  }

  annotations: PolygonAnnotation[] = [];
  selectedAnnotation?: PolygonAnnotation;
  store = markRaw(useGlobalStore());
  layer?: Raw<Konva.Layer>;

  constructor() {
    // When a new ImageAnnotation is created, copy the last used micrometerPerPixel value:
    this.micrometerPerPixel = ImageAnnotation.lastMicrometerPerPixel;
  }

  rightClickPoint(point: PointLike): void {
    // ...existing code...
    if (this.selectedAnnotation) {
      this.selectedAnnotation.removeLastPoint();

      if (this.selectedAnnotation.points.length === 0) {
        this.annotations = this.annotations.filter(ann => ann !== this.selectedAnnotation);
        this.selectedAnnotation = undefined as any;
        // this.store.currentTool = null;
      }

      this.redrawAnnotations();
    }
  }

  clickPoint(point: PointLike): void {

    // If there is no selected annotation, create a new one with the selected tool
    if (!this.selectedAnnotation) {
      const tool = this.store.currentTool;
      console.log('Creating annotation', tool);

      // if (tool === 'line') {
      //   this.selectedAnnotation = new LineAnnotation();
      //   this.annotations.push(this.selectedAnnotation);
      // } else
      if (tool === 'polygon') {
        this.selectedAnnotation = new PolygonAnnotation();
        // Assign the parent reference
        this.selectedAnnotation.parent = this;
        this.annotations.push(this.selectedAnnotation);
      }
    }
    if (this.selectedAnnotation) {


      // If there is a selected annotation, update it with the new point
      const res = this.selectedAnnotation.addPoint(point);
      if (res === 'complete') {
        this.selectedAnnotation = undefined as any;
        console.log('Annotation complete');
      }
    }
    this.redrawAnnotations();
  }

  removeAnnotation(annotation: PolygonAnnotation): void {
    this.annotations = this.annotations.filter(ann => ann !== annotation);
    this.redrawAnnotations();
  }

  processKeydown(event: KeyboardEvent): void {
    // ...existing code...
    if (event.key === 'Escape') {
      if (this.selectedAnnotation) {
        this.removeAnnotation(this.selectedAnnotation);
        this.selectedAnnotation = undefined as any;
      }
    }

    if (event.key == "Enter") {
      if (this.selectedAnnotation) {
        this.selectedAnnotation.hoveredPoint = undefined;

        this.selectedAnnotation.points = this.selectedAnnotation.getCombinedPoints();
        console.log('Annotation complete', this.selectedAnnotation.points.length);
        this.selectedAnnotation = undefined as any;
        this.store.currentTool = null;

        // Sort the annotations by area
        this.annotations.sort((a, b) => b.area - a.area);
      }
    }

    this.redrawAnnotations();
  }

  hoverPoint(point: PointLike): void {
    // ...existing code...
    if (this.selectedAnnotation) {
      this.selectedAnnotation.hoveredPoint = new Point(point.x, point.y);
      this.redrawAnnotations();
    }
  }

  redrawAnnotations(): void {
    if (this.layer) {
      this.layer.destroyChildren();
      this.annotations.forEach(ann => ann.render(this.layer!));
      this.layer.batchDraw();
    }
  }

  toJSON(): string {
    return JSON.stringify({
      filePath: this.filePath,
      micrometerPerPixel: this.micrometerPerPixel,
      annotations: this.annotations.map(ann => ({
        points: ann.points, // Points will be used to recalc the area later via loadJSON
        color: ann.color
      }))
    });
  }

  static fromJSON(json: string): ImageAnnotation {
    const data = JSON.parse(json);
    const imageAnn = new ImageAnnotation();
    imageAnn.filePath = data.filePath;
    imageAnn.micrometerPerPixel = data.micrometerPerPixel;
    imageAnn.annotations = (data.annotations ?? []).map((ann: any) => {
      const polygon = new PolygonAnnotation();
      polygon.parent = imageAnn;
      polygon.loadJSON(ann);
      return polygon;
    });
    console.log("Loaded annotations", imageAnn, json);
    return imageAnn;
  }

  // Getter: Smallest polygon area
  get smallestPolygonArea(): number {
    const areas = this.annotations.map(ann => ann.area);
    return areas.length ? Math.min(...areas) : 0;
  }

  // Getter: Biggest polygon area
  get biggestPolygonArea(): number {
    const areas = this.annotations.map(ann => ann.area);
    return areas.length ? Math.max(...areas) : 0;
  }

  // Getter: Smallest polygon circumference
  get smallestPolygonCircumference(): number {
    const circumferences = this.annotations.map(ann => ann.circumference);
    return circumferences.length ? Math.min(...circumferences) : 0;
  }

  // Getter: Biggest polygon circumference
  get biggestPolygonCircumference(): number {
    const circumferences = this.annotations.map(ann => ann.circumference);
    return circumferences.length ? Math.max(...circumferences) : 0;
  }

  // Getter: Wall thickness ratio = (a_b - a_s) / a_s, where a_b and a_s are biggest and smallest polygon areas respectively.
  get wallThicknessRatio(): number {
    const aSmall = this.smallestPolygonArea;
    if (aSmall === 0) return 0;
    return (this.biggestPolygonArea - aSmall) / aSmall;
  }
}

