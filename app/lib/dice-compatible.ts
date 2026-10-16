import * as THREE from "./three-legacy/index.mjs";
import { RoundedBoxGeometry } from "./three-legacy/addons/RoundedBoxGeometry.mjs";
import { RoomEnvironment } from "./three-legacy/addons/RoomEnvironment.mjs";
import { DIE_RADIUS as RADIUS, DIE_COLOR, PIP_COLOR, PIP_RADIUS, DIE_UV_SCALE as UV_SCALE, PIPS, HALF_PI, DIE_FACES as FACES, FACE_ROTATIONS, DIE_CAMERA_ZOOM, DIE_CANVAS_SCALE, dieCameraPosition, pipMask } from "./dice";
import type { DiceRenderer } from "./dice";
import { createDiceShading } from "./dice-shading";

function makeDie() {
  const model = new THREE.Group();
  const shading = createDiceShading();
  const geometry = new RoundedBoxGeometry(1, 1, 1, 4, RADIUS);
  const masks: THREE.CanvasTexture[] = [];
  const materials = FACES.map((face) => {
    const canvas = pipMask(face, 256);
    const mask = new THREE.CanvasTexture(canvas);
    mask.anisotropy = 2;
    masks.push(mask);
    return new THREE.MeshPhysicalMaterial({
      color: DIE_COLOR, roughness: 0.32, metalness: 0,
      clearcoat: 0.35, clearcoatRoughness: 0.24,
      alphaMap: mask, alphaTest: 0.5, envMapIntensity: 0.06,
    });
  });
  const body = new THREE.Mesh(geometry, materials);
  materials.forEach((material) => {
    material.onBeforeCompile = shading.onBeforeCompile;
    material.customProgramCacheKey = () => "dice-shading-v1";
  });
  model.add(body);

  // Openings in the shell reveal actual concave pip meshes below the surface.
  const profile = Array.from({ length: 9 }, (_, step) => {
    const radius = (PIP_RADIUS + 0.001) * step / 8;
    return new THREE.Vector2(radius, -0.035 * (1 - (step / 8) ** 2));
  });
  const pipGeometry = new THREE.LatheGeometry(profile, 24);
  pipGeometry.rotateX(HALF_PI);
  const pipMaterial = new THREE.MeshStandardMaterial({
    color: PIP_COLOR, roughness: 0.52, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.06,
  });
  // Merge all 21 recessed pips so older GPUs draw them in one call per pass.
  const source = pipGeometry.toNonIndexed();
  const pipPositions = new Float32Array(source.getAttribute("position").array.length * 21);
  const pipNormals = new Float32Array(source.getAttribute("normal").array.length * 21);
  let offset = 0;
  FACES.forEach((face, faceIndex) => {
    const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(FACE_ROTATIONS[faceIndex][0], FACE_ROTATIONS[faceIndex][1], 0));
    PIPS[face].forEach((pip) => {
      const transform = rotation.clone().multiply(new THREE.Matrix4().makeTranslation(
        ((pip % 3) - 1) * 0.25 * UV_SCALE, (1 - Math.floor(pip / 3)) * 0.25 * UV_SCALE, 0.5005,
      ));
      const pocket = source.clone().applyMatrix4(transform);
      const positions = pocket.getAttribute("position").array;
      pipPositions.set(positions, offset);
      pipNormals.set(pocket.getAttribute("normal").array, offset);
      offset += positions.length;
      pocket.dispose();
    });
  });
  source.dispose();
  const pocketsGeometry = new THREE.BufferGeometry();
  pocketsGeometry.setAttribute("position", new THREE.BufferAttribute(pipPositions, 3));
  pocketsGeometry.setAttribute("normal", new THREE.BufferAttribute(pipNormals, 3));
  const pockets = new THREE.Mesh(pocketsGeometry, pipMaterial);
  model.add(pockets);
  return {
    model,
    shading,
    setColor(color: string) { materials.forEach((material) => material.color.set(color)); },
    setUnrolled(unrolled: boolean) {
      model.children.slice(1).forEach((pips) => { pips.visible = !unrolled; });
      materials.forEach((material, index) => {
        const mask = unrolled ? null : masks[index];
        if (material.alphaMap !== mask) {
          material.alphaMap = mask;
          material.needsUpdate = true;
        }
      });
    },
    dispose() {
      geometry.dispose();
      pipGeometry.dispose();
      pocketsGeometry.dispose();
      pipMaterial.dispose();
      materials.forEach((material) => material.dispose());
      masks.forEach((mask) => mask.dispose());
    },
  };
}


// Keep this engine isolated: r162 is the last Three.js release that supports WebGL 1.
export function createCompatibleDiceRenderer(): DiceRenderer {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl", { antialias: true, alpha: true });
  if (!context) throw new Error("WebGL 1 is unavailable.");
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setClearColor(0x000000, 0);
    renderer.debug.onShaderError = () => { throw new Error("The 3D shader could not compile."); };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    camera.position.set(...dieCameraPosition());
    camera.lookAt(0, 0.3, 0);
    // Overscan leaves room for airborne corners outside the button.
    camera.zoom = DIE_CAMERA_ZOOM / DIE_CANVAS_SCALE;
    camera.updateProjectionMatrix();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment(renderer);
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    // Reflection strength is set on materials in this older renderer.
    room.dispose();
    pmrem.dispose();
    const die = makeDie();
    scene.add(die.model);
    const key = new THREE.DirectionalLight("#ffffff", 3.2);
    scene.add(key);
    const topLight = new THREE.DirectionalLight("#ffffff", 0.65);
    topLight.position.set(0, 6, 0);
    scene.add(topLight);
    const fill = new THREE.DirectionalLight("#ffffff", 0.08);
    fill.position.set(4, 2, -3);
    scene.add(fill, new THREE.HemisphereLight("#ffffff", "#555555", 0.08));

    return {
      element: renderer.domElement,
      kind: "compatible",
      resize(width, height) {
        renderer.setSize(width * 2, height * 1.6, false);
        camera.aspect = (width * 2) / (height * 1.6);
        camera.updateProjectionMatrix();
      },
      render(pose) {
        die.setUnrolled(!!pose.unrolled);
        die.shading.update(pose.shading);
        renderer.toneMappingExposure = 0.9 * pose.brightness;
        die.setColor(pose.dieColor);
        camera.position.set(...dieCameraPosition(pose.turnDegrees, pose.tiltDegrees));
        camera.lookAt(0, 0.3, 0);
        die.model.rotation.set(...pose.rotation);
        die.model.position.set(...pose.position);
        key.position.set(...pose.light);
        renderer.render(scene, camera);
      },
      dispose() {
        die.dispose();
        environment.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
}
