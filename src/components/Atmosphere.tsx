import { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 displaced = position;
    displaced += normal * (
      sin(position.x * 2.7 + uTime * 0.42) * 0.006 +
      sin(position.y * 3.8 - uTime * 0.31) * 0.004
    );
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDirection), 0.0), 2.85);
    float upperGlow = smoothstep(-6.4, -1.15, vWorldPosition.y);
    float breathing = 0.94 + sin(uTime * 0.48) * 0.06;

    vec3 deep = vec3(0.018, 0.052, 0.125);
    vec3 cobalt = vec3(0.133, 0.424, 0.718);
    vec3 sky = vec3(0.537, 0.749, 0.965);
    vec3 ice = vec3(0.631, 0.925, 0.996);
    vec3 color = mix(deep, cobalt, upperGlow * 0.56);
    color = mix(color, sky, fresnel * 0.72);
    color += ice * pow(fresnel, 4.0) * 0.66;

    gl_FragColor = vec4(color * breathing, 0.985);
  }
`;

export function Atmosphere() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    const host = container.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.18, 8.6);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isMobile,
        powerPreference: isMobile ? "low-power" : "high-performance",
      });
    } catch {
      host.classList.add("is-fallback");
      return () => host.classList.remove("is-fallback");
    }
    renderer.setClearAlpha(0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.15 : 1.7));
    host.appendChild(renderer.domElement);

    const uniforms = { uTime: { value: 0 } };
    const sphereGeometry = new THREE.SphereGeometry(
      4.9,
      isMobile ? 96 : 160,
      isMobile ? 64 : 96,
    );
    const sphereMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.y = -6.35;
    sphere.rotation.z = -0.08;
    scene.add(sphere);

    const particleCount = isMobile ? 260 : 760;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);
    for (let index = 0; index < particleCount; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 9.6;
      positions[index * 3 + 1] = -1.3 + Math.random() * 1.72;
      positions[index * 3 + 2] = (Math.random() - 0.5) * 2.6;
      velocities[index] = 0.18 + Math.random() * 0.34;
    }

    const particleGeometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    particleGeometry.setAttribute("position", positionAttribute);
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: isMobile ? 0.018 : 0.024,
      transparent: true,
      opacity: 0.84,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const pointer = new THREE.Vector2();
    const targetPointer = new THREE.Vector2();
    const handlePointer = (event: PointerEvent) => {
      targetPointer.set(
        (event.clientX / window.innerWidth - 0.5) * 2,
        -(event.clientY / window.innerHeight - 0.5) * 2,
      );
    };

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      sphere.scale.setScalar(camera.aspect < 0.85 ? 0.9 : 1);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    window.addEventListener("pointermove", handlePointer, { passive: true });
    resize();

    let previous = performance.now();
    let elapsed = 0;
    let frame = 0;
    let isVisible = false;
    const scheduleRender = () => {
      if (frame || !isVisible || document.hidden) return;
      frame = window.requestAnimationFrame(render);
    };
    const render = (timestamp: number) => {
      frame = 0;
      const delta = Math.min((timestamp - previous) / 1000, 0.05);
      previous = timestamp;
      if (!reduceMotion) elapsed += delta;
      uniforms.uTime.value = reduceMotion ? 1.25 : elapsed;
      pointer.lerp(targetPointer, 0.035);

      if (!reduceMotion) {
        sphere.rotation.y = elapsed * 0.055;
        for (let index = 0; index < particleCount; index += 1) {
          const offset = index * 3;
          positions[offset] += velocities[index] * delta;
          if (positions[offset] > 4.9) positions[offset] = -4.9;
        }
        positionAttribute.needsUpdate = true;
      }

      scene.rotation.x = pointer.y * 0.018;
      scene.rotation.y += (pointer.x * 0.025 - scene.rotation.y) * 0.025;
      renderer.render(scene, camera);
      if (!reduceMotion) scheduleRender();
    };
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          previous = performance.now();
          scheduleRender();
        } else if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "120px 0px" },
    );
    const onVisibilityChange = () => {
      previous = performance.now();
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
      window.removeEventListener("pointermove", handlePointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      observer.disconnect();
      visibilityObserver.disconnect();
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="hero-sphere" ref={container} aria-hidden="true" />;
}
