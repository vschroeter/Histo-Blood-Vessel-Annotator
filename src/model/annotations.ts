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

  hoveredPoint?: Point;

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
  // Add a reactive area property
  // area: Ref<number> = ref(0);
  area: number = 0;

  constructor() {
    super();
    this.color = 'blue';
  }
  render(layer: Konva.Layer): Konva.Shape {
    const flat = this.points.reduce((acc, pt) => acc.concat([pt.x, pt.y]), [] as number[]);

    if (flat.length >= 2) {

      if (this.hoveredPoint) {
        flat.push(this.hoveredPoint.x, this.hoveredPoint.y);
      }

      flat.push(flat[0]!, flat[1]!);
    }



    const polygon = new Konva.Line({
      points: flat,
      stroke: this.color,
      strokeWidth: 2,
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

  addPoint(point: PointLike): AddPointResult {
    this.points.push(new Point(point.x, point.y));
    this.calculateArea();
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
  filePath?: string;
  pixelPerMicro?: number;
  annotations: PolygonAnnotation[] = [];

  selectedAnnotation?: PolygonAnnotation;

  store = markRaw(useGlobalStore());

  layer?: Raw<Konva.Layer>;


  rightClickPoint(point: PointLike): void {

    // const a = markRaw(new PolygonAnnotation());

    if (this.selectedAnnotation) {
      this.selectedAnnotation.removeLastPoint();

      if (this.selectedAnnotation.points.length === 0) {
        this.annotations = this.annotations.filter(ann => ann !== this.selectedAnnotation);
        this.selectedAnnotation = undefined as any;
        this.store.currentTool = null;
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

    if (event.key === 'Escape') {
      if (this.selectedAnnotation) {
        this.removeAnnotation(this.selectedAnnotation);
        this.selectedAnnotation = undefined as any;
      }
    }

    if (event.key == "Enter") {
      if (this.selectedAnnotation) {
        this.selectedAnnotation = undefined as any;
        this.store.currentTool = null;
      }
    }

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
      this.annotations.forEach(ann => ann.render(this.layer!));
      this.layer.batchDraw();
    }

  }

  toJSON(): string {
    return JSON.stringify({
      filePath: this.filePath,
      pixelPerMicro: this.pixelPerMicro,
      annotations: this.annotations,
    });
  }

  static fromJSON(json: string): ImageAnnotation {
    const data = JSON.parse(json);
    const imageAnn = new ImageAnnotation();
    imageAnn.filePath = data.filePath;
    imageAnn.pixelPerMicro = data.pixelPerMicro;
    // Note: You might need more robust rehydration of each annotation instance.
    imageAnn.annotations = data.annotations || [];
    return imageAnn;
  }
}

