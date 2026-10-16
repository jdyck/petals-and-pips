// Private r162 engine for the WebGL 1 fallback. Import source modules rather
// than the package entry point, which registers a second global Three.js instance.
// The local addons use this same engine so their objects never mix revisions.
export { BufferAttribute } from "three-legacy/src/core/BufferAttribute.js";
export { BufferGeometry } from "three-legacy/src/core/BufferGeometry.js";
export { Group } from "three-legacy/src/objects/Group.js";
export { Mesh } from "three-legacy/src/objects/Mesh.js";
export { BoxGeometry } from "three-legacy/src/geometries/BoxGeometry.js";
export { LatheGeometry } from "three-legacy/src/geometries/LatheGeometry.js";
export { MeshBasicMaterial } from "three-legacy/src/materials/MeshBasicMaterial.js";
export { MeshPhysicalMaterial } from "three-legacy/src/materials/MeshPhysicalMaterial.js";
export { MeshStandardMaterial } from "three-legacy/src/materials/MeshStandardMaterial.js";
export { Euler } from "three-legacy/src/math/Euler.js";
export { Matrix4 } from "three-legacy/src/math/Matrix4.js";
export { Vector2 } from "three-legacy/src/math/Vector2.js";
export { Vector3 } from "three-legacy/src/math/Vector3.js";
export { DirectionalLight } from "three-legacy/src/lights/DirectionalLight.js";
export { HemisphereLight } from "three-legacy/src/lights/HemisphereLight.js";
export { PointLight } from "three-legacy/src/lights/PointLight.js";
export { Scene } from "three-legacy/src/scenes/Scene.js";
export { PerspectiveCamera } from "three-legacy/src/cameras/PerspectiveCamera.js";
export { PMREMGenerator } from "three-legacy/src/extras/PMREMGenerator.js";
export { CanvasTexture } from "three-legacy/src/textures/CanvasTexture.js";
export { WebGLRenderer } from "three-legacy/src/renderers/WebGLRenderer.js";
export { ACESFilmicToneMapping, BackSide, DoubleSide, SRGBColorSpace } from "three-legacy/src/constants.js";
