export const CM_TO_SCENE = 0.02;

export function cm(v: number) {
  return v * CM_TO_SCENE;
}

export function liters(length: number, width: number, height: number) {
  return (length * width * height) / 1000;
}

export function round1(v: number) {
  return Math.round(v * 10) / 10;
}
