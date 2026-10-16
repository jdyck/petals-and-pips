import { DIE_FACES, FACE_ROTATIONS, DIE_UV_SCALE, PIPS } from "./dice";

type Attribute = { count: number; getX(index: number): number; getY(index: number): number; getZ(index: number): number };
type IndexedGeometry = {
  getAttribute(name: string): Attribute;
  getIndex(): { count: number; getX(index: number): number } | null;
};

// Pack the same recessed pocket onto every face without duplicating vertices
// for each triangle. Plain buffers keep the two Three.js engines isolated.
export function combinePipGeometry(source: IndexedGeometry) {
  const position = source.getAttribute("position");
  const normal = source.getAttribute("normal");
  const index = source.getIndex();
  if (!index) throw new Error("Pip geometry must be indexed.");
  const count = DIE_FACES.reduce((total, face) => total + PIPS[face].length, 0);
  // Both models fit 16-bit indices, including the full model's 11,193 vertices.
  if (position.count * count > 65536) throw new Error("Pip geometry exceeds the WebGL 1 index budget.");
  const positions = new Float32Array(position.count * count * 3);
  const normals = new Float32Array(normal.count * count * 3);
  const indices = new Uint16Array(index.count * count);
  let pocket = 0;

  DIE_FACES.forEach((face, faceIndex) => {
    const [x, y] = FACE_ROTATIONS[faceIndex];
    const sx = Math.sin(x), cx = Math.cos(x), sy = Math.sin(y), cy = Math.cos(y);
    const rotate = (target: Float32Array, offset: number, px: number, py: number, pz: number) => {
      target[offset] = cy * px + sy * pz;
      target[offset + 1] = sx * sy * px + cx * py - sx * cy * pz;
      target[offset + 2] = -cx * sy * px + sx * py + cx * cy * pz;
    };
    for (const pip of PIPS[face]) {
      const vertexOffset = pocket * position.count;
      const px = ((pip % 3) - 1) * 0.25 * DIE_UV_SCALE;
      const py = (1 - Math.floor(pip / 3)) * 0.25 * DIE_UV_SCALE;
      for (let vertex = 0; vertex < position.count; vertex++) {
        const offset = (vertexOffset + vertex) * 3;
        rotate(positions, offset, position.getX(vertex) + px, position.getY(vertex) + py, position.getZ(vertex) + 0.5005);
        rotate(normals, offset, normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex));
      }
      for (let triangle = 0; triangle < index.count; triangle++) {
        indices[pocket * index.count + triangle] = vertexOffset + index.getX(triangle);
      }
      pocket++;
    }
  });
  return { positions, normals, indices };
}
