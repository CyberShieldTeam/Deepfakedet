export type Affine = [number, number, number, number, number, number];
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function validAffine(m: unknown): m is Affine {
  return (
    Array.isArray(m) &&
    m.length === 6 &&
    m.every((v) => typeof v === "number" && Number.isFinite(v)) &&
    Math.abs(m[0] * m[4] - m[1] * m[3]) > 1e-12
  );
}
export function mappedBox(box: Box, m: Affine): Box {
  if (!validAffine(m)) throw new Error("Invalid OCR coordinate transform");
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ].map(([x, y]) => [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]]);
  const x = Math.min(...corners.map((p) => p[0])),
    y = Math.min(...corners.map((p) => p[1]));
  return {
    x,
    y,
    width: Math.max(...corners.map((p) => p[0])) - x,
    height: Math.max(...corners.map((p) => p[1])) - y,
  };
}
