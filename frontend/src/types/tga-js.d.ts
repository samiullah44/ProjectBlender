declare module 'tga-js' {
  export default class TGA {
    constructor();
    load(buffer: Uint8Array): void;
    getCanvas(): HTMLCanvasElement;
    getDataURL(type?: string): string;
  }
}
