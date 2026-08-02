import { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform vec2 uResolution;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / max(uResolution.y, 1.0);

    float drift = sin(uv.y * 4.8 + uTime * 0.72) * 0.075;
    drift += sin(uv.y * 10.0 - uTime * 0.43) * 0.025;
    drift += uPointer.x * 0.07;

    float core = exp(-abs(uv.x - drift) * 13.0);
    float body = exp(-abs(uv.x - drift) * 4.2);
    float rays = exp(-abs(uv.x - drift) * 1.35) * 0.32;
    float taper = smoothstep(-1.0, -0.22, uv.y) * smoothstep(1.12, 0.05, uv.y);
    float mist = noise(vec2(uv.x * 2.4, uv.y * 3.1 - uTime * 0.16));
    float pulse = 0.88 + sin(uTime * 1.1) * 0.12;

    vec3 navy = vec3(0.023, 0.071, 0.167);
    vec3 blue = vec3(0.133, 0.424, 0.718);
    vec3 sky = vec3(0.537, 0.749, 0.965);
    vec3 ice = vec3(0.631, 0.925, 0.996);
    vec3 color = mix(blue, ice, clamp(uv.y * 0.5 + 0.52, 0.0, 1.0));
    color = mix(navy, color, core + body * 0.8);
    color += sky * rays * (0.6 + mist * 0.45);

    float alpha = (core * 1.05 + body * 0.52 + rays * 0.42) * taper * pulse;
    alpha += mist * body * 0.08 * taper;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

export function LightPillar() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;

    const host = root.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch {
      host.classList.add("is-fallback");
      return () => host.classList.remove("is-fallback");
    }
    renderer.setClearAlpha(0);
    host.appendChild(renderer.domElement);

    const uniforms = {
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };
    const material = new THREE.ShaderMaterial({
      fragmentShader,
      vertexShader,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const pointerTarget = new THREE.Vector2();
    const handlePointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointerTarget.set(
        ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        0,
      );
    };

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const pixelRatio = Math.min(window.devicePixelRatio, 1.6);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener("pointermove", handlePointer, { passive: true });
    resize();

    const startedAt = performance.now();
    let frame = 0;
    let isVisible = false;
    const scheduleRender = () => {
      if (frame || !isVisible || document.hidden) return;
      frame = window.requestAnimationFrame(render);
    };
    const render = (timestamp: number) => {
      frame = 0;
      uniforms.uTime.value = reduceMotion ? 1.4 : (timestamp - startedAt) / 1000;
      uniforms.uPointer.value.lerp(pointerTarget, 0.045);
      renderer.render(scene, camera);
      if (!reduceMotion) scheduleRender();
    };
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) scheduleRender();
        else if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "120px 0px" },
    );
    const onVisibilityChange = () => {
      if (document.hidden && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        scheduleRender();
      }
    };
    visibilityObserver.observe(host);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", handlePointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      observer.disconnect();
      visibilityObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="light-pillar" ref={root} aria-hidden="true" />;
}
