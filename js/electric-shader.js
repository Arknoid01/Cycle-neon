import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;

  void main() {
    vUv = uv;
    vLocalPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uSparkColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform float uScale;
  uniform float uBody;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float along = dot(vWorldPos.xz, vec2(1.0, 0.85)) * uScale + uTime * uSpeed;
    float across = vLocalPos.z;

    float band = exp(-across * across * 55.0);

    float n = noise(vec2(along * 2.4, uTime * 0.35)) * 0.18;
    float zig = sin(along * 18.0 + uTime * uSpeed * 4.0) * 0.11;
    float zig2 = sin(along * 31.0 - uTime * uSpeed * 6.5) * 0.06;
    float center = zig + zig2 + n;

    float bolt = exp(-pow(across - center, 2.0) * 420.0);
    float bolt2 = exp(-pow(across + center * 0.75, 2.0) * 280.0) * 0.55;

    float runner = sin(along * 14.0 - uTime * uSpeed * 5.0);
    float spark = smoothstep(0.82, 1.0, runner) * (bolt + bolt2);

    float vert = sin(vWorldPos.y * 6.0 + along * 3.0 + uTime * uSpeed * 2.0) * 0.04;
    bolt += exp(-pow(across - center - vert, 2.0) * 200.0) * 0.35;

    vec3 body = uColor * band * uBody;
    vec3 elec = mix(uColor, uSparkColor, 0.92) * (bolt + bolt2) * uIntensity;
    vec3 flash = uSparkColor * spark * 2.8;

    vec3 col = body + elec + flash;
    float alpha = clamp(band * uBody * 0.65 + (bolt + bolt2) * 0.9 + spark * 0.85, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

/** @param {{ color: number, sparkColor?: number, speed?: number, intensity?: number, scale?: number, body?: number }} opts */
export function createElectricMaterial(opts) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color) },
      uSparkColor: { value: new THREE.Color(opts.sparkColor ?? 0xffffff) },
      uTime: { value: 0 },
      uSpeed: { value: opts.speed ?? 1.4 },
      uIntensity: { value: opts.intensity ?? 1.2 },
      uScale: { value: opts.scale ?? 1.1 },
      uBody: { value: opts.body ?? 0.55 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.userData.baseSpeed = opts.speed ?? 1.4;
  mat.userData.baseIntensity = opts.intensity ?? 1.2;
  return mat;
}

export function updateElectricMaterial(mat, timeSec, overrides = {}) {
  if (!mat?.uniforms) return;
  mat.uniforms.uTime.value = timeSec;
  const speed = overrides.speed ?? mat.uniforms.uSpeed.value;
  const intensity = overrides.intensity ?? mat.uniforms.uIntensity.value;
  mat.uniforms.uSpeed.value = speed;
  mat.uniforms.uIntensity.value = intensity;
}

export function setElectricColor(mat, color, sparkColor) {
  mat.uniforms.uColor.value.set(color);
  if (sparkColor !== undefined) mat.uniforms.uSparkColor.value.set(sparkColor);
}
