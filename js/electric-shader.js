import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec3 vLocalPos;

  void main() {
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uSparkColor;
  uniform float uIntensity;
  uniform float uBody;
  uniform vec3 uAcrossDir;

  varying vec3 vLocalPos;

  void main() {
    float across = dot(vLocalPos, uAcrossDir);
    float band = exp(-across * across * 32.0);
    vec3 core = mix(uColor, uSparkColor, 0.22);
    vec3 col = core * uIntensity * band;
    float alpha = band * clamp(uBody + 0.4, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const AXIS_X = new THREE.Vector3(1, 0, 0);

/** @param {{ color: number, sparkColor?: number, intensity?: number, body?: number, alongDir?: THREE.Vector3, acrossDir?: THREE.Vector3 }} opts */
export function createElectricMaterial(opts) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color) },
      uSparkColor: { value: new THREE.Color(opts.sparkColor ?? 0xcccccc) },
      uIntensity: { value: opts.intensity ?? 0.95 },
      uBody: { value: opts.body ?? 0.55 },
      uAcrossDir: { value: (opts.acrossDir ?? AXIS_X).clone() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.userData.baseIntensity = opts.intensity ?? 0.95;
  return mat;
}

export function updateElectricMaterial(mat, overrides = {}) {
  if (!mat?.uniforms) return;
  if (overrides.intensity !== undefined) {
    mat.uniforms.uIntensity.value = overrides.intensity;
  }
}

export function setElectricColor(mat, color, sparkColor) {
  mat.uniforms.uColor.value.set(color);
  if (sparkColor !== undefined) mat.uniforms.uSparkColor.value.set(sparkColor);
}

export { AXIS_X, AXIS_Y, AXIS_Z };
