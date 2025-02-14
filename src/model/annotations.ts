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
  areaPixel: number = 0;

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

  // Change areaInMicroSquared to use the parent's micrometerPerPixel property
  get areaInMicroSquared(): number {
    const mpp = this.parent ? this.parent.micrometerPerPixel ?? 1 : 1;
    return this.areaPixel * (mpp ** 2);
  }

  // Calculate circumference (closed polygon)
  get circumferenceBasedOnLength(): number {
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

  // The circumference of a circle with the same area
  get circumferenceBasedOnArea(): number {
    const r = Math.sqrt(this.areaPixel / Math.PI);
    return 2 * Math.PI * r;
  }

  // Diameter of a circle with the same circumference
  get diameterBasedOnArea(): number {
    return this.circumferenceBasedOnArea / Math.PI;
  }

  get radiusBasedOnArea(): number {
    return this.diameterBasedOnArea / 2;
  }

  get areaBasedOnCircumference(): number {
    const c = this.circumferenceBasedOnLength;
    const r = c / (2 * Math.PI);
    return Math.PI * r * r;
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
    const epsilon = 3; // adjust tolerance as needed

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
    // console.log('Points:', this.points.length);
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
  get micrometerPerPixel(): number {
    return this._micrometerPerPixel ?? 0.36;
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
        this.annotations.sort((a, b) => b.areaPixel - a.areaPixel);
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
      // this.layer.batchDraw();
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
    const imageAnn = new ImageAnnotation();
    try {
      const data = JSON.parse(json);
      imageAnn.filePath = data.filePath;
      imageAnn.micrometerPerPixel = data.micrometerPerPixel;
      imageAnn.annotations = (data.annotations ?? []).map((ann: any) => {
        const polygon = new PolygonAnnotation();
        polygon.parent = imageAnn;
        polygon.loadJSON(ann);
        return polygon;
      });
      console.log("Loaded annotations for", imageAnn.filePath);
    } catch (error) {
      console.error('Error parsing annotations:', error);
    }
    return imageAnn;
  }


  get biggestAnnotation(): PolygonAnnotation | undefined {
    return this.annotations.length > 0 ? this.annotations.reduce((largest, ann) =>
      ann.areaPixel > largest.areaPixel ? ann : largest
    ) : undefined;
  }

  get smallestAnnotation(): PolygonAnnotation | undefined {
    return this.annotations.length > 0 ? this.annotations.reduce((smallest, ann) =>
      ann.areaPixel < smallest.areaPixel ? ann : smallest
    ) : undefined;
  }

  // Outer circumference
  get outerCircumference(): number {
    const biggest = this.biggestAnnotation;
    return biggest ? biggest.circumferenceBasedOnLength : 0;
  }

  get wallAreaPixel(): number {
    if (!this.biggestAnnotation || !this.smallestAnnotation || this.annotations.length < 2) return 0;

    const outerAreaPixel = this.biggestAnnotation.areaPixel;
    const innerAreaPixel = this.smallestAnnotation.areaPixel;
    return outerAreaPixel - innerAreaPixel
  }

  get outerCircleAreaCalculated(): number {
    if (!this.biggestAnnotation || !this.smallestAnnotation || this.annotations.length < 2) return 0;

    // Assumption: The outer wall can be transformed into a circle with the same circumference
    const outerCircumference = this.outerCircumference;
    const outerCircleRadius = outerCircumference / (2 * Math.PI);
    const outerCircleArea = Math.PI * outerCircleRadius * outerCircleRadius;
    return outerCircleArea;
  }

  get outerCircleAreaCalculatedInMicroSquared(): number {
    return this.outerCircleAreaCalculated * (this.micrometerPerPixel ?? 1) ** 2;
  }

  get outerCircleDiameterBasedOnCalculatedArea(): number {
    return Math.sqrt(this.outerCircleAreaCalculated / Math.PI) * 2;
  }

  get averageWallThickness(): number {
    if (!this.biggestAnnotation || !this.smallestAnnotation || this.annotations.length < 2) return 0;

    // Assumption: The outer wall can be transformed into a circle with the same circumference
    const outerCircumference = this.outerCircumference;
    const outerCircleRadius = outerCircumference / (2 * Math.PI);
    const outerCircleArea = this.outerCircleAreaCalculated;

    // Assumption: Wall thickness stays always the same, no matter how the vessel is crumbled
    const innerArea = outerCircleArea - this.wallAreaPixel;
    const innerCircleRadius = Math.sqrt(innerArea / Math.PI);

    return outerCircleRadius - innerCircleRadius;
  }

  // get wallAreaCalculated() {

  //   const aSmall = this.innerAreaCalculated;
  //   const aBig = this.outerCircleAreaCalculated;
  //   let area = aBig - aSmall;

  //   area = Math.PI * outerCircleRadius * outerCircleRadius - Math.PI * innerCircleRadius * innerCircleRadius;
  //   area = Math.PI * outerCircleRadius ** 2 - Math.PI * (outerCircleArea - outerAreaPixel - innerAreaPixel) / Math.PI);
  //   area = outerCircleArea - (outerCircleArea - outerAreaPixel - innerAreaPixel) ;
  // }

  get averageWallThicknessInMicro(): number {
    return this.averageWallThickness * (this.micrometerPerPixel ?? 1);
  }

  get innerAreaCalculated(): number {

    if (!this.biggestAnnotation || !this.smallestAnnotation || this.annotations.length < 2) return 0;

    const outerCircleArea = this.outerCircleAreaCalculated;
    const outerCircleDiameter = this.outerCircleDiameterBasedOnCalculatedArea;
    const outerCircleRadius = outerCircleDiameter / 2;
    const averageWallThickness = this.averageWallThickness;

    const innerCircleRadius = outerCircleRadius - averageWallThickness;
    const innerCircleArea = Math.PI * innerCircleRadius * innerCircleRadius;
    return innerCircleArea;

    // if (!this.biggestAnnotation || !this.smallestAnnotation || this.annotations.length < 2) return 0;
    // // Assumption: The outer wall can be transformed into a circle with the same circumference
    // const outerCircleArea = this.outerCircleAreaCalculated;

    // // Assumption: Wall thickness stays always the same, no matter how the vessel is crumbled
    // const innerArea = outerCircleArea - this.wallAreaPixel;
    // return innerArea;
  }

  get innerAreaCalculatedEasy() {
    if (!this.biggestAnnotation || !this.smallestAnnotation || this.annotations.length < 2) return 0;

    // Assumption: The outer wall can be transformed into a circle with the same circumference
    const outerCircleArea = this.outerCircleAreaCalculated;

    // Assumption: Wall thickness stays always the same, no matter how the vessel is crumbled
    const innerArea = outerCircleArea - this.wallAreaPixel;
    return innerArea;
  }

  get innerAreaCalculatedInMicroSquared(): number {
    return this.innerAreaCalculated * (this.micrometerPerPixel ?? 1) ** 2;
  }

  get mediaLumenRatio(): number {
    const aSmall = this.innerAreaCalculated;
    const aBig = this.outerCircleAreaCalculated;

    if (aSmall === 0) return 0;

    return (aBig - aSmall) / aSmall;

    // Wandfläche / (ideale große Fläche - tatsächliche Wandfläche)
  }

  get outerCalculatedDiameterInMicro(): number {
    return Math.sqrt(this.outerCircleAreaCalculatedInMicroSquared / Math.PI) * 2;
  }
  get innerCalculatedDiameterInMicro(): number {

    return Math.sqrt(this.innerAreaCalculatedInMicroSquared / Math.PI) * 2;
  }


  // // Pixel getters
  // get smallestPolygonAreaPixel(): number {
  //   const areas = this.annotations.map(ann => ann.area);
  //   return areas.length ? Math.min(...areas) : 0;
  // }

  // get biggestPolygonAreaPixel(): number {
  //   const areas = this.annotations.map(ann => ann.area);
  //   return areas.length ? Math.max(...areas) : 0;
  // }

  // get smallestPolygonCircumferencePixel(): number {
  //   const circumferences = this.annotations.map(ann => ann.circumferenceBasedOnLength);
  //   return circumferences.length ? Math.min(...circumferences) : 0;
  // }

  // get biggestPolygonCircumferencePixel(): number {
  //   const circumferences = this.annotations.map(ann => ann.circumferenceBasedOnLength);
  //   return circumferences.length ? Math.max(...circumferences) : 0;
  // }

  // get wallThicknessRatio(): number {
  //   const aSmall = this.smallestPolygonAreaPixel;
  //   if (aSmall === 0) return 0;
  //   return (this.biggestPolygonAreaPixel - aSmall) / aSmall;
  // }

  // get smallestPolygonDiameterPixel(): number {
  //   const diameters = this.annotations.map(ann => ann.diameterBasedOnArea);
  //   return diameters.length ? Math.min(...diameters) : 0;
  // }

  // get biggestPolygonDiameterPixel(): number {
  //   const diameters = this.annotations.map(ann => ann.diameterBasedOnArea);
  //   return diameters.length ? Math.max(...diameters) : 0;
  // }


  // // Micro getters (converted to microns)
  // get smallestPolygonAreaMicro(): number {
  //   const areas = this.annotations.map(ann => ann.areaInMicroSquared);
  //   return areas.length ? Math.min(...areas) : 0;
  // }

  // get biggestPolygonAreaMicro(): number {
  //   const areas = this.annotations.map(ann => ann.areaInMicroSquared);
  //   return areas.length ? Math.max(...areas) : 0;
  // }

  // get smallestPolygonCircumferenceMicro(): number {
  //   const circumferences = this.annotations.map(ann => ann.circumferenceBasedOnArea * (this.micrometerPerPixel ?? 1));
  //   return circumferences.length ? Math.min(...circumferences) : 0;
  // }

  // get biggestPolygonCircumferenceMicro(): number {
  //   const circumferences = this.annotations.map(ann => ann.circumferenceBasedOnArea * (this.micrometerPerPixel ?? 1));
  //   return circumferences.length ? Math.max(...circumferences) : 0;
  // }

  // get smallestPolygonDiameterMicro(): number {
  //   const diameters = this.annotations.map(ann => ann.diameterBasedOnArea * (this.micrometerPerPixel ?? 1));
  //   return diameters.length ? Math.min(...diameters) : 0;
  // }

  // get biggestPolygonDiameterMicro(): number {
  //   const diameters = this.annotations.map(ann => ann.diameterBasedOnArea * (this.micrometerPerPixel ?? 1));
  //   return diameters.length ? Math.max(...diameters) : 0;
  // }





}

