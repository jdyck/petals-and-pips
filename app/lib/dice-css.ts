import { DIE_FACES, FACE_ROTATIONS, PIPS, DIE_TILT_DEGREES, DIE_COLOR, PIP_COLOR, PIP_RADIUS, DIE_CAMERA_ZOOM } from "./dice";
import type { DiceRenderer } from "./dice";
import { diceSurfaceColor } from "./dice-shading";

// Even without WebGL, show six faces rotating in perspective instead of a flat tile.
export function createCssDiceRenderer(): DiceRenderer {
  const element = document.createElement("span");
  element.className = "die-css-renderer";
  element.style.setProperty("--die-color", DIE_COLOR);
  element.style.setProperty("--pip-color", PIP_COLOR);
  element.style.setProperty("--pip-size", `${PIP_RADIUS * 200}%`);
  const camera = document.createElement("span");
  camera.className = "die-css-camera";
  const cube = document.createElement("span");
  cube.className = "die-css-cube";
  const faces = DIE_FACES.map((value, index) => {
    const face = document.createElement("span");
    face.className = "die-css-face";
    face.style.transform = `rotateX(${-FACE_ROTATIONS[index][0]}rad) rotateY(${FACE_ROTATIONS[index][1]}rad) translateZ(calc(var(--cube-size) / 2))`;
    for (const pip of PIPS[value]) {
      const pocket = document.createElement("i");
      pocket.className = "die-css-pip";
      pocket.style.left = `${25 + (pip % 3) * 25}%`;
      pocket.style.top = `${25 + Math.floor(pip / 3) * 25}%`;
      face.appendChild(pocket);
    }
    cube.appendChild(face);
    return face;
  });
  camera.appendChild(cube);
  element.appendChild(camera);
  let size = 32;
  const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  return {
    element,
    kind: "css",
    resize(_width, height) {
      size = height * 0.4 * DIE_CAMERA_ZOOM / (1.72 / 1.6);
      element.style.setProperty("--cube-size", `${size}px`);
      element.style.perspective = `${size * 9}px`;
    },
    render(pose) {
      element.dataset.unrolled = String(!!pose.unrolled);
      element.style.setProperty("--die-color", pose.dieColor);
      element.style.setProperty("--pip-color", pose.pipColor);
      const shade = pose.dieColor.replace(/[a-f\d]{2}/gi, (channel) => Math.round(parseInt(channel, 16) * 0.94).toString(16).padStart(2, "0"));
      element.style.setProperty("--die-shade-color", shade);
      camera.style.transform = `rotateX(${(pose.tiltDegrees ?? DIE_TILT_DEGREES) - 90}deg) rotateY(${-pose.turnDegrees}deg)`;
      const [x, y, z] = pose.rotation;
      cube.style.transform = `translate3d(${pose.position[0] * size}px, ${-pose.position[1] * size}px, 0) rotateX(${-x}rad) rotateY(${y}rad) rotateZ(${-z}rad)`;
      const lightLength = Math.hypot(...pose.light);
      normals.forEach(([nx, ny, nz], index) => {
        faces[index].style.filter = pose.brightness === 1 ? "" : `brightness(${pose.brightness})`;
        const rx = Math.cos(y) * nx + Math.sin(y) * nz;
        const ry = Math.sin(x) * Math.sin(y) * nx + Math.cos(x) * ny - Math.sin(x) * Math.cos(y) * nz;
        const rz = -Math.cos(x) * Math.sin(y) * nx + Math.sin(x) * ny + Math.cos(x) * Math.cos(y) * nz;
        const diffuse = Math.max(0, (rx * pose.light[0] + ry * pose.light[1] + rz * pose.light[2]) / lightLength);
        const topLight = Math.max(0, ry) * 0.06;
        const lighting = Math.min(1, 0.50 + diffuse * 0.50 + topLight);
        faces[index].style.background = pose.shading ? diceSurfaceColor(pose.shading, ry, lighting) : "";
        faces[index].style.setProperty("--face-shade", pose.shading ? "0" : `${1 - lighting}`);
      });
    },
    dispose() { element.remove(); },
  };
}
