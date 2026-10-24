export interface SceneTransform {
  x: number;
  y: number;
  scale: number;
}
export const INITIAL_TRANSFORM: Readonly<SceneTransform> = Object.freeze({
  x: 0,
  y: 0,
  scale: 1,
});
export const clampScale = (scale: number) => Math.max(0.65, Math.min(4, scale));
/** Zoom about a logical SVG point; does not mutate layout or calculation values. */
export function zoomAt(
  t: SceneTransform,
  next: number,
  point = { x: 550, y: 325 },
): SceneTransform {
  const scale = clampScale(next),
    ratio = scale / t.scale;
  return {
    scale,
    x: point.x - (point.x - t.x) * ratio,
    y: point.y - (point.y - t.y) * ratio,
  };
}
export function pinchTransform(
  t: SceneTransform,
  start: { x: number; y: number },
  end: { x: number; y: number },
  ratio: number,
): SceneTransform {
  const next = zoomAt(t, t.scale * ratio, start);
  return { ...next, x: next.x + end.x - start.x, y: next.y + end.y - start.y };
}
