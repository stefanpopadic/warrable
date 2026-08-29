import { describe, expect, it } from "vitest";
import { contentBounds } from "./trim-image";

function solid(
  width: number,
  height: number,
  rgba: [number, number, number, number],
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  return data;
}

function paint(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: [number, number, number, number],
) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
}

describe("contentBounds", () => {
  it("trims black letterbox around a bright subject", () => {
    const w = 40;
    const h = 90;
    const data = solid(w, h, [0, 0, 0, 255]);
    paint(data, w, 10, 35, 30, 55, [80, 180, 220, 255]);
    const bounds = contentBounds(data, w, h);
    expect(bounds).not.toBeNull();
    expect(bounds!.h).toBeLessThan(h * 0.5);
    expect(bounds!.w / bounds!.h).toBeGreaterThan(0.7);
  });

  it("trims transparent padding around opaque ink", () => {
    const w = 50;
    const h = 50;
    const data = solid(w, h, [0, 0, 0, 0]);
    paint(data, w, 15, 15, 35, 35, [255, 255, 255, 255]);
    const bounds = contentBounds(data, w, h);
    expect(bounds).not.toBeNull();
    expect(bounds!.w).toBeLessThan(40);
    expect(bounds!.h).toBeLessThan(40);
  });

  it("leaves an already-tight frame alone", () => {
    const w = 20;
    const h = 20;
    const data = solid(w, h, [200, 40, 40, 255]);
    expect(contentBounds(data, w, h)).toBeNull();
  });
});
