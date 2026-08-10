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

    float band = exp(-across * across * 38.0);

    float n = noise(vec2(along * 1.8, uTime * 0.25)) * 0.1;
    float zig = sin(along * 11.0 + uTime * uSpeed * 3.2) * 0.32;
    float zig2 = sin(along * 17.5 - uTime * uSpeed * 5.8) * 0.16;
    float center = zig + zig2 + n;

    float dist = abs(across - center);
    float bolt = smoothstep(0.11, 0.0, dist);
    float boltCore = smoothstep(0.038, 0.0, dist);

    float runner = smoothstep(0.86, 1.0, sin(along * 9.0 - uTime * uSpeed * 4.5));
    float spark = boltCore * runner;

    vec3 body = uColor * band * uBody * 0.35;
    body *= (1.0 - boltCore * 0.65);

    vec3 elecHalo = mix(uColor, uSparkColor, 0.32) * bolt * uIntensity * 0.38;
    vec3 elecCore = uSparkColor * boltCore * uIntensity * 1.5;
    vec3 flash = uSparkColor * spark * 2.0;

    vec3 col = body + elecHalo + elecCore + flash;
    float alpha = clamp(band * uBody * 0.35 + bolt * 0.55 + boltCore * 0.95, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

/** @param {{ color: number, sparkColor?: number, speed?: number, intensity?: number, scale?: number, body?: number }} opts */
export function createElectricMaterial(opts) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color) },
      uSparkColor: { value: new THREE.Color(opts.sparkColor ?? 0xcccccc) },
      uTime: { value: 0 },
      uSpeed: { value: opts.speed ?? 1.4 },
      uIntensity: { value: opts.intensity ?? 0.95 },
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
  mat.userData.baseIntensity = opts.intensity ?? 0.95;
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
