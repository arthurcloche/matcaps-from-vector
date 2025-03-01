import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

const containerEl = document.querySelector(".container");
const canvasEl = document.querySelector("#canvas-3d");
const previewsContainer = document.querySelector(".matcap-previews");

let renderer, scene, camera, orbit, material, geometry;

// no need to use a 3d noise here,
// keeping ImprovedNoise() just for code simplicity
const perlin = new ImprovedNoise();

const params = {
  resolution: 12,
  previewPadding: 3,
  amplitude: 1,
};
const texturesURL = [
  "https://ksenia-k.com/img/threejs/matcaps/1.png",
  "https://ksenia-k.com/img/threejs/matcaps/2.png",
  "https://ksenia-k.com/img/threejs/matcaps/3.png",
  "https://ksenia-k.com/img/threejs/matcaps/4.png",
  "https://ksenia-k.com/img/threejs/matcaps/5.png",
  "https://ksenia-k.com/img/threejs/matcaps/6.png",
  "https://ksenia-k.com/img/threejs/matcaps/7.png",
];
const textureLoader = new THREE.TextureLoader();
const textures = [];

// Create a single canvas for texture rendering
const tempCanvas = document.createElement("canvas");
const tempCtx = tempCanvas.getContext("2d");

initScene();
createControls();
window.addEventListener("resize", updateSceneSize);

texturesURL.forEach((url, idx) => {
  const imgContainer = document.createElement("div");
  const img = document.createElement("img");
  previewsContainer.appendChild(imgContainer);
  imgContainer.appendChild(img);

  textures.push(
    textureLoader.load(url, (t) => {
      // Use the single canvas to render the texture
      tempCanvas.width = t.image.width;
      tempCanvas.height = t.image.height;
      tempCtx.drawImage(t.image, 0, 0);

      // Set the image source from the canvas
      img.src = tempCanvas.toDataURL();

      imgContainer.style.margin = params.previewPadding + "px";
      imgContainer.style.padding = params.previewPadding + "px";
      imgContainer.onclick = function () {
        const prevSelection = previewsContainer.querySelector(".active");
        if (prevSelection) {
          prevSelection.classList.remove("active");
        }
        imgContainer.classList.add("active");
        material.matcap = t;
      };

      if (idx === 5) {
        imgContainer.classList.add("active");
        material.matcap = t;
      }

      if (textures.length === texturesURL.length) {
        // Remove the temporary canvas once all textures are processed
        tempCanvas.remove();
        updateSceneSize();
      }
    })
  );
});

function initScene() {
  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas: canvasEl,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    45,
    containerEl.clientWidth / containerEl.clientHeight,
    1,
    50
  );
  camera.position.set(0, 1, 10);

  // Custom ShaderMaterial with matcap functionality
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform sampler2D matcapTexture;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      vec3 x = normalize(vec3(viewDir.z, 0.0, -viewDir.x));
      vec3 y = cross(viewDir, x);
      vec2 uv = vec2(dot(x, normal), dot(y, normal)) * 0.495 + 0.5;
      vec4 matcapColor = texture2D(matcapTexture, uv);
      gl_FragColor = matcapColor;
    }
  `;

  material = new THREE.ShaderMaterial({
    uniforms: {
      matcapTexture: { value: null },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.DoubleSide,
  });

  // Update the material.matcap setter to work with our shader material
  Object.defineProperty(material, "matcap", {
    set: function (texture) {
      this.uniforms.matcapTexture.value = texture;
    },
  });

  orbit = new OrbitControls(camera, canvasEl);
  orbit.enableZoom = false;
  orbit.enablePan = false;
  orbit.enableDamping = true;
  orbit.minPolarAngle = 0.4 * Math.PI;
  orbit.maxPolarAngle = 0.6 * Math.PI;

  geometry = new THREE.PlaneGeometry(
    5,
    4,
    5 * params.resolution,
    4 * params.resolution
  );
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  mesh.rotation.set(-0.5 * Math.PI, 0, 0.15 * Math.PI);

  updateSceneSize();
  render();
}

function render(time) {
  orbit.update();
  renderer.render(scene, camera);

  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 2] = perlin.noise(
      0.5 * positions[i] + 0.0005 * time,
      0.5 * positions[i + 1] + 0.0005 * time,
      0
    );
    positions[i + 2] -=
      1.5 *
      perlin.noise(
        0.2 * positions[i] - 0.0002 * time,
        0.2 * positions[i + 1] + 0.0002 * time,
        0
      );
    positions[i + 2] *= params.amplitude;
  }
  geometry.attributes.position.copyArray(positions);
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
  material.needsUpdate = true;

  requestAnimationFrame(render);
}

function updateSceneSize() {
  camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
  if (textures) {
    const w = 0.8 * Math.min(window.innerWidth, window.innerHeight);
    Array.from(previewsContainer.children).forEach((img) => {
      img.style.width = w - 4 * params.previewPadding + "px";
    });
  }
}

function createControls() {
  const gui = new GUI();
  gui.add(params, "amplitude", 0, 1.5).name("noise amplitude");
}
