import { Point } from "2d-geometry";
import Konva from "konva";
import { ref, type Ref } from "vue";
import { ImageAnnotation } from "./annotations";
import { useGlobalStore } from "src/stores/global-store";
import { useThrottleFn } from "@vueuse/core";


export class KonvaImageViewer {

  stage: Konva.Stage;
  container: HTMLDivElement;

  imageLayer: Konva.Layer;
  annotationLayer: Konva.Layer;

  image: Konva.Image | null = null;

  currentPixel: Ref<{ x: number, y: number }> = ref({ x: 0, y: 0 });
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

    // Disable image smoothing on layer canvas context
    const context = this.imageLayer.getCanvas().getContext();
    context.imageSmoothingEnabled = false;

    // Optionally, disable smoothing after each draw:
    this.imageLayer.on('batchDraw', () => {
      const context = this.imageLayer.getCanvas().getContext();
      context.imageSmoothingEnabled = false;
    });

    // Zoom on wheel
    this.stage.on('wheel', (e: any) => {
      e.evt.preventDefault();
      const oldScale = this.stage.scaleX();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      const scaleBy = 1.1;
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      this.currentZoom.value = newScale;
      this.stage.scale({ x: newScale, y: newScale });

      // Adjust position to keep pointer stationary
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

    // Display pointer position considering zoom & pan
    this.stage.on('mousemove', (e) => {
      this.updateMousePosition();

      // updateMousePosition({ x: pos.x, y: pos.y }).catch(console.error);

      // // Convert this.stage coordinates to image pixel position
      // console.log(`Stage pointer: (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
    });

    // Add double-click to reset view
    this.stage.on('dblclick', () => {
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
    });

    // Update this.stage size on window resize
    window.addEventListener('resize', () => {
      console.log('Window resize event');
      if (this.container) {
        this.stage.width(this.container.clientWidth);
        this.stage.height(this.container.clientHeight);
        this.stage.batchDraw();
      }
    });

    // // Add click event for annotation points
    // this.stage.on('click', (e) => {
    //   if (!store.currentTool) return;
    //   const pointer = this.stage.getPointerPosition();
    //   if (!pointer) return;
    //   const x = (pointer.x - this.stage.x()) / this.stage.scaleX();
    //   const y = (pointer.y - this.stage.y()) / this.stage.scaleY();
    //   const pt = new Point(x, y);
    //   currentAnnotationPoints.value.push(pt);
    //   currentImageAnnotation.value?.redrawAnnotations(annotationLayer, currentAnnotationPoints.value, store.currentTool);
    //   if (store.currentTool === 'line' && currentAnnotationPoints.value.length === 2) {
    //     const ann = new LineAnnotation(currentAnnotationPoints.value[0], currentAnnotationPoints.value[1]);
    //     currentImageAnnotation.value?.annotations.push(ann);
    //     currentImageAnnotation.value?.redrawAnnotations(annotationLayer);
    //     currentAnnotationPoints.value = [];
    //     store.currentTool = null;
    //     // Save annotations to file
    //     saveAnnotations().catch(console.error);
    //   }
    // });

    // // Mouse move to update preview (after first click)
    // this.stage.on('mousemove', (e) => {
    //   if (!store.currentTool || currentAnnotationPoints.value.length === 0) return;
    //   const pointer = this.stage.getPointerPosition();
    //   if (!pointer) return;
    //   const x = (pointer.x - this.stage.x()) / this.stage.scaleX();
    //   const y = (pointer.y - this.stage.y()) / this.stage.scaleY();
    //   const previewPoints = [...currentAnnotationPoints.value];
    //   previewPoints[previewPoints.length - 1] = new Point(x, y);
    //   currentImageAnnotation.value?.redrawAnnotations(annotationLayer, previewPoints, store.currentTool);
    // });

    // // Listen for Enter key to finish polygon annotation
    // document.addEventListener('keydown', (e: KeyboardEvent) => {
    //   if (store.currentTool === 'polygon' && e.key === 'Enter' && currentAnnotationPoints.value.length > 2) {
    //     const ann = new PolygonAnnotation([...currentAnnotationPoints.value]);
    //     currentImageAnnotation.value?.annotations.push(ann);
    //     currentImageAnnotation.value?.redrawAnnotations(annotationLayer);
    //     currentAnnotationPoints.value = [];
    //     store.currentTool = null;
    //     saveAnnotations().catch(console.error);
    //   }
    // });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      this.processKeydown(e);

      if (e.key === 'Enter') {
        this.saveAnnotations().catch(console.error);

      }

    });

    console.log('Konva this.stage initialized');

  }

  ////////////////////////////////////////////////////////////////////////////
  // #region Drawings
  ////////////////////////////////////////////////////////////////////////////

  redrawThrottled = useThrottleFn(() => {
    this.redraw();
  }, 50);

  redraw() {
    this.annotationLayer.destroyChildren();
    this.imageAnnotation?.redrawAnnotations();
    this.stage.batchDraw();
  }


  ////////////////////////////////////////////////////////////////////////////
  // #region Pixel Position
  ////////////////////////////////////////////////////////////////////////////

  updateMousePosition() {
    const pos = this.stage.getPointerPosition();
    if (!pos) return;

    // Include this.stage position and scale to get the correct image pixel position
    pos.x -= this.stage.x();
    pos.y -= this.stage.y();

    pos.x /= this.stage.scaleX();
    pos.y /= this.stage.scaleY();

    this.currentPixel.value = { x: pos.x, y: pos.y };
    return this.currentPixel.value;
  }

  ////////////////////////////////////////////////////////////////////////////
  // #region Annotations
  ////////////////////////////////////////////////////////////////////////////

  processKeydown(e: KeyboardEvent) {
    this.imageAnnotation?.processKeydown(e);
  }

  async loadAnnotationsForImage(imagePath: string): Promise<void> {
    const fileName = imagePath.split('/').pop() || imagePath;
    const annFilePath = this.store.folderPath + '/annotations/' + fileName + '_annotations.json';
    const annData = await window.electronAPI.loadAnnotationsData(annFilePath);
    let imageAnn: ImageAnnotation;
    if (annData) {
      imageAnn = ImageAnnotation.fromJSON(annData);
    } else {
      imageAnn = new ImageAnnotation();
    }
    imageAnn.filePath = imagePath;
    imageAnn.layer = this.annotationLayer;


    this.imageAnnotation = imageAnn;

    // TODO: Change this to just a const variable
    this.store.currentImageAnnotation = imageAnn;

    imageAnn.redrawAnnotations();
  }

  async saveAnnotations(): Promise<void> {
    if (this.imageAnnotation) {
      const fileName = this.imageAnnotation.filePath?.split('/').pop() || '';
      const annFilePath = this.store.folderPath + '/annotations/' + fileName + '_annotations.json';
      const jsonData = this.imageAnnotation.toJSON();
      await window.electronAPI.saveAnnotationsData(annFilePath, jsonData);
    }
  }


  //   // Helper: save current annotations as JSON file via electronAPI
  // async function saveAnnotations() {
  //   if (!currentImageAnnotation.value || !store.folderPath || !store.currentImagePath) return;
  //   const fileName = store.currentImagePath.split('/').pop() || store.currentImagePath;
  //   const annFilePath = store.folderPath + '/' + fileName + '_annotations.json';
  //   const jsonData = currentImageAnnotation.value.toJSON();
  //   try {
  //     await window.electronAPI.saveAnnotationsData(annFilePath, jsonData);
  //   } catch (error) {
  //     console.error('Error saving annotations:', error);
  //   }
  // }


  ////////////////////////////////////////////////////////////////////////////
  // #region Image Loading
  ////////////////////////////////////////////////////////////////////////////

  async loadImage(imagePath: string): Promise<void> {
    console.log('Loading image:', imagePath);
    // loading.value = true;

    return new Promise<void>((resolve, reject) => {
      (async () => {
        try {

          // Save old annotations before loading new image
          await this.saveAnnotations();

          const base64Data = await window.electronAPI.getPngData(imagePath);
          const imageSrc = base64Data ? `data:image/png;base64,${base64Data}` : '';

          if (imageSrc) {
            const img = new window.Image();
            img.onload = async () => {
              try {
                // Remove previous image if any
                if (this.image) {
                  this.image.destroy();
                }
                this.image = new Konva.Image({
                  image: img,
                  x: 0,
                  y: 0,
                  draggable: false,
                });
                // Compute scale factor to fit image completely in the container
                const containerWidth = this.container.clientWidth || img.width;
                const containerHeight = this.container.clientHeight || img.height;
                const scaleFactor = Math.min(containerWidth / img.width, containerHeight / img.height);
                // Reset stage transform: top left corner and computed scale
                this.stage.position({ x: 0, y: 0 });
                this.stage.scale({ x: scaleFactor, y: scaleFactor });
                this.currentZoom.value = scaleFactor;
                this.currentPixel.value = { x: 0, y: 0 };

                this.imageLayer.add(this.image);
                this.imageLayer.batchDraw();

                // Load stored annotations if available
                await this.loadAnnotationsForImage(imagePath);

                resolve();
              } catch (error: unknown) {
                console.error(error);
                reject(new Error('Error loading image'));
              }
            };
            img.onerror = (error: any) => {
              console.error('Error loading image:', error);
              reject(new Error('Error loading image'));
            };
            img.src = imageSrc;
            // loading.value = false;
          } else {
            reject(new Error('Error loading image'));
            // loading.value = false;
          }
        } catch (error) {
          console.error('Error loading image:', error);
          reject(new Error('Error loading image'));
          // loading.value = false;
        }
      })().catch(reject);

    });
  }
}
