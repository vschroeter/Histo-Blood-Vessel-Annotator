import Konva from 'konva';
import { type Point } from "2d-geometry";

export interface Renderable {
  render(layer: Konva.Layer): Konva.Shape;
}

export abstract class Annotation implements Renderable {
  abstract render(layer: Konva.Layer): Konva.Shape;
}

export class LineAnnotation extends Annotation {
  constructor(public start: Point, public end: Point) {
    super();
  }
  render(layer: Konva.Layer): Konva.Shape {
    const points = [this.start.x, this.start.y, this.end.x, this.end.y];
    const line = new Konva.Line({
      points,
      stroke: 'red',
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
    });
    layer.add(line);
    return line;
  }
}

export class PolygonAnnotation extends Annotation {
  constructor(public points: Point[]) {
    super();
  }
  render(layer: Konva.Layer): Konva.Shape {
    const flat = this.points.reduce((acc, pt) => acc.concat([pt.x, pt.y]), [] as number[]);
    const polygon = new Konva.Line({
      points: flat,
      stroke: 'blue',
      strokeWidth: 2,
      closed: true,
      lineCap: 'round',
      lineJoin: 'round',
    });
    layer.add(polygon);
    return polygon;
  }
}

export class ImageAnnotation {
  filePath?: string;
  pixelPerMicro?: number;
  annotations: Annotation[] = [];

  redrawAnnotations(
    annotationLayer: Konva.Layer,
    previewPoints?: Point[],
    currentTool?: 'line' | 'polygon'
  ): void {
    annotationLayer.destroyChildren();
    // Render stored annotations
    this.annotations.forEach(ann => ann.render(annotationLayer));
    // Render preview if provided
    if (previewPoints && previewPoints.length && currentTool) {
      if (currentTool === 'line') {
        if (previewPoints.length === 1) {
          const circle = new Konva.Circle({
            x: previewPoints[0]!.x,
            y: previewPoints[0]!.y,
            radius: 4,
            fill: 'red',
          });
          annotationLayer.add(circle);
        } else {
          const line = new Konva.Line({
            points: previewPoints.reduce((acc, p) => acc.concat([p.x, p.y]), [] as number[]),
            stroke: 'red',
            strokeWidth: 2,
            lineCap: 'round',
            lineJoin: 'round',
          });
          annotationLayer.add(line);
          previewPoints.forEach(p => {
            const handle = new Konva.Circle({
              x: p.x,
              y: p.y,
              radius: 4,
              fill: 'white',
              stroke: 'red',
              strokeWidth: 1,
              draggable: true,
            });
            annotationLayer.add(handle);
          });
        }
      } else if (currentTool === 'polygon') {
        const poly = new Konva.Line({
          points: previewPoints.reduce((acc, p) => acc.concat([p.x, p.y]), [] as number[]),
          stroke: 'blue',
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'round',
          closed: false,
        });
        annotationLayer.add(poly);
        previewPoints.forEach(p => {
          const handle = new Konva.Circle({
            x: p.x,
            y: p.y,
            radius: 4,
            fill: 'white',
            stroke: 'blue',
            strokeWidth: 1,
          });
          annotationLayer.add(handle);
        });
      }
    }
    annotationLayer.batchDraw();
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

