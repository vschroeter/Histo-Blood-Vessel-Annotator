import Konva from 'konva';
import { nextTick, ref, type Ref } from 'vue';
import { ImageAnnotation } from './annotations';
import { useGlobalStore } from 'src/stores/global-store';
import { useResizeObserver, useThrottleFn } from '@vueuse/core';

export class KonvaImageViewer {
  stage: Konva.Stage;
  container: HTMLDivElement;
  imageLayer: Konva.Layer;
  annotationLayer: Konva.Layer;
  image: Konva.Image | null = null;
  currentPixel: Ref<{ x: number; y: number }> = ref({ x: 0, y: 0 });
  currentZoom = ref(1);
  store: ReturnType<typeof useGlobalStore>;
  imageAnnotation?: ImageAnnotation;

  constructor(container: HTMLDivElement) {
    this.store = useGlobalStore();
    this.container = container;

    this.stage = new Konva.Stage({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
      draggable: true,
    });

    this.imageLayer = new Konva.Layer();
    this.annotationLayer = new Konva.Layer();
    this.stage.add(this.imageLayer);
    this.stage.add(this.annotationLayer);

    const context = this.imageLayer.getCanvas().getContext();
    context.imageSmoothingEnabled = false;
    this.imageLayer.on('batchDraw', () => {
      this.imageLayer.getCanvas().getContext().imageSmoothingEnabled = false;
    });

    this.stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const oldScale = this.stage.scaleX();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      const scaleBy = 1.1;
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      this.currentZoom.value = newScale;
      this.stage.scale({ x: newScale, y: newScale });
      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale,
      };
      this.stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
      this.stage.batchDraw();
    });

    this.stage.on('mousemove', () => {
      this.updateMousePosition();
    });

    this.stage.on('dblclick', () => {
      this.resetView();
    });

    useResizeObserver(this.container, () => {
      if (this.container) {
        nextTick(() => {
          this.stage.width(this.container.clientWidth);
          this.stage.height(this.container.clientHeight);
          this.stage.batchDraw();
          this.resetView();
        }).catch(console.error);
      }
    });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      this.processKeydown(e);
      if (e.key === 'Enter') {
        this.saveAnnotations().catch(console.error);
      }
    });
  }

  redrawThrottled = useThrottleFn(() => {
    this.redraw();
  }, 50);

  redraw() {
    this.annotationLayer.destroyChildren();
    this.imageAnnotation?.redrawAnnotations();
    this.stage.batchDraw();
  }

  resetView() {
    if (this.image) {
      const imgElement = this.image.image() as HTMLImageElement;
      const containerWidth = this.container.clientWidth || imgElement.width;
      const containerHeight = this.container.clientHeight || imgElement.height;
      const scaleFactor = Math.min(containerWidth / imgElement.width, containerHeight / imgElement.height);
      this.stage.position({ x: 0, y: 0 });
      this.stage.scale({ x: scaleFactor, y: scaleFactor });
      this.stage.batchDraw();
      this.currentZoom.value = scaleFactor;
      this.currentPixel.value = { x: 0, y: 0 };
    }
  }

  updateMousePosition() {
    const pos = this.stage.getPointerPosition();
    if (!pos) return;

    pos.x -= this.stage.x();
    pos.y -= this.stage.y();
    pos.x /= this.stage.scaleX();
    pos.y /= this.stage.scaleY();

    this.currentPixel.value = { x: pos.x, y: pos.y };
    return this.currentPixel.value;
  }

  processKeydown(e: KeyboardEvent) {
    this.imageAnnotation?.processKeydown(e);
  }

  async loadAnnotationsForImage(imagePath: string): Promise<void> {
    const fileName = imagePath.split('/').pop() || imagePath;
    const annFilePath = this.store.folderPath + '/annotations/' + fileName + '_annotations.json';
    const annData = await window.electronAPI.loadAnnotationsData(annFilePath);
    const imageAnn = annData ? ImageAnnotation.fromJSON(annData) : new ImageAnnotation();
    imageAnn.filePath = imagePath;
    imageAnn.layer = this.annotationLayer;
    this.imageAnnotation = imageAnn;
    this.store.currentImageAnnotation = imageAnn;
    imageAnn.redrawAnnotations();
  }

  async saveAnnotations(): Promise<void> {
    if (this.imageAnnotation && this.imageAnnotation.annotations.length > 0) {
      const fileName = this.imageAnnotation.filePath?.split('/').pop() || '';
      const annFilePath = this.store.folderPath + '/annotations/' + fileName + '_annotations.json';
      await window.electronAPI.saveAnnotationsData(annFilePath, this.imageAnnotation.toJSON());
    }
  }

  async loadImage(imagePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      (async () => {
        try {
          await this.saveAnnotations();

          const base64Data = await window.electronAPI.getPngData(imagePath);
          const imageSrc = base64Data ? `data:image/png;base64,${base64Data}` : '';

          if (!imageSrc) {
            reject(new Error('Error loading image'));
            return;
          }

          const img = new window.Image();
          img.onload = async () => {
            try {
              if (this.image) {
                this.image.destroy();
              }
              this.image = new Konva.Image({
                image: img,
                x: 0,
                y: 0,
                draggable: false,
              });
              const containerWidth = this.container.clientWidth || img.width;
              const containerHeight = this.container.clientHeight || img.height;
              const scaleFactor = Math.min(containerWidth / img.width, containerHeight / img.height);
              this.stage.position({ x: 0, y: 0 });
              this.stage.scale({ x: scaleFactor, y: scaleFactor });
              this.currentZoom.value = scaleFactor;
              this.currentPixel.value = { x: 0, y: 0 };

              this.imageLayer.add(this.image);
              this.imageLayer.batchDraw();
              await this.loadAnnotationsForImage(imagePath);
              resolve();
            } catch (error: unknown) {
              console.error(error);
              reject(new Error('Error loading image'));
            }
          };
          img.onerror = (error) => {
            console.error('Error loading image:', error);
            reject(new Error('Error loading image'));
          };
          img.src = imageSrc;
        } catch (error) {
          console.error('Error loading image:', error);
          reject(new Error('Error loading image'));
        }
      })().catch(reject);
    });
  }
}
