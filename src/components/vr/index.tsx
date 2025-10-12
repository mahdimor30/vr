"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * ARViewer (React + TypeScript)
 *
 * Props:
 *  - modelUrl: string -> مسیر فایل .glb (مثلاً /models/rug.glb)
 *  - initialScale?: number
 *  - arButtonLabel?: string
 *  - className?: string
 *
 * توضیحات:
 *  - کامپوننت در حالت عادی یک canvas three.js ایجاد می‌کند.
 *  - با زدن دکمه Enter AR، WebXR session باز می‌شود (در مرورگر پشتیبانی‌شده).
 *  - reticle برای hit-test نمایش داده می‌شود؛ با انتخاب (tap) مدل در آن نقطه قرار می‌گیرد.
 *  - کنترل‌های ساده UI بعد از قرارگیری برای scale/rotate ارائه شده‌اند.
 *
 * نکته: این کامپوننت به‌صورت داینامیک three.js و loaderها را بارگذاری می‌کند تا با SSR تداخل نداشته باشد.
 */

type ARViewerProps = {
  modelUrl: string;
  initialScale?: number;
  arButtonLabel?: string;
  className?: string;
};

export default function ARViewer({
  modelUrl,
  initialScale = 0.5,
  arButtonLabel = "نمایش در اتاق شما (AR)",
  className,
}: ARViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [placed, setPlaced] = useState(false);
  const [scale, setScale] = useState(initialScale);
  const [rotationDeg, setRotationDeg] = useState(0);

  useEffect(() => {
    let renderer: any = null;
    let scene: any = null;
    let camera: any = null;
    let reticle: any = null;
    let rug: any = null;
    let hitTestSource: any = null;
    let hitTestSourceRequested = false;
    let three: any = null;
    let xrSession: any = null;
    let animationFrameId: number | null = null;

    let mounted = true;

    async function init() {
      // dynamic imports to avoid SSR issues
      const THREE = await import("three");
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      const { ARButton } = await import(
        "three/examples/jsm/webxr/ARButton.js"
      );

      three = THREE;

      // Scene
      scene = new THREE.Scene();

      // Camera
      camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
      );

      // Lights
      const hemi = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
      scene.add(hemi);

      const dir = new THREE.DirectionalLight(0xffffff, 0.6);
      dir.position.set(0.5, 1, 0.5);
      scene.add(dir);

      // Renderer
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      renderer.xr.setFramebufferScaleFactor(1);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";

      if (!mounted) return;

      // attach canvas
      if (containerRef.current) {
        containerRef.current.appendChild(renderer.domElement);
      }

      // AR Button
      const arButtonEl = ARButton.createButton(renderer, {
        requiredFeatures: ["hit-test"],
      });
      // style the button a bit
      arButtonEl.style.position = "absolute";
      arButtonEl.style.bottom = "18px";
      arButtonEl.style.left = "50%";
      arButtonEl.style.transform = "translateX(-50%)";
      arButtonEl.style.padding = "10px 14px";
      arButtonEl.textContent = arButtonLabel;

      if (containerRef.current) {
        containerRef.current.appendChild(arButtonEl);
      }

      // Reticle (ring)
      const ringGeo = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        opacity: 0.8,
        transparent: true,
      });
      reticle = new THREE.Mesh(ringGeo, ringMat);
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      // Load model but keep it hidden until placement
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          rug = gltf.scene;
          rug.traverse((child: any) => {
            if (child.isMesh) {
              child.castShadow = false;
              child.receiveShadow = true;
            }
          });
          rug.scale.set(scale, scale, scale);
          rug.rotation.x = -Math.PI / 2; // if your model is flat on X axis, adjust
          rug.visible = false;
          scene.add(rug);
        },
        undefined,
        (err) => {
          console.error("GLTF load error:", err);
        }
      );

      // controller for select event
      const controller = renderer.xr.getController(0);
      scene.add(controller);

      controller.addEventListener("select", () => {
        if (reticle && reticle.visible && rug) {
          // place rug at reticle pose
          const pos = new THREE.Vector3();
          pos.setFromMatrixPosition(reticle.matrix);
          rug.position.copy(pos);

          // orientation: align rug's Y rotation with camera yaw
          const camQuat = camera.quaternion.clone();
          const euler = new THREE.Euler().setFromQuaternion(camQuat, "YXZ");
          rug.rotation.y = euler.y + THREE.MathUtils.degToRad(rotationDeg);
          rug.visible = true;
          setPlaced(true);
        }
      });

      // animation loop + hit test handling
      function onSessionStart(session: any) {
        xrSession = session;
        session.addEventListener("end", onSessionEnd);
      }

      function onSessionEnd() {
        hitTestSourceRequested = false;
        hitTestSource = null;
        xrSession = null;
        reticle.visible = false;
        setPlaced(false);
      }

      renderer.setAnimationLoop((time: any, frame: any) => {
        if (frame) {
          const referenceSpace = renderer.xr.getReferenceSpace();
          const session = renderer.xr.getSession();

          if (!hitTestSourceRequested) {
            session
              .requestReferenceSpace("viewer")
              .then((refSpace: any) => {
                return session.requestHitTestSource({ space: refSpace });
              })
              .then((source: any) => {
                hitTestSource = source;
              })
              .catch((err: any) => {
                console.warn("hitTestSource request failed:", err);
              });

            session.addEventListener("end", () => {
              hitTestSourceRequested = false;
              hitTestSource = null;
            });

            hitTestSourceRequested = true;
          }

          if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0) {
              const hit = hitTestResults[0];
              const pose = hit.getPose(renderer.xr.getReferenceSpace());
              reticle.visible = true;
              reticle.matrix.fromArray(pose.transform.matrix);
            } else {
              reticle.visible = false;
            }
          }
        }

        renderer.render(scene, camera);
      });

      // listen to sessionstart
      renderer.xr.addEventListener("sessionstart", (ev: any) => {
        onSessionStart(ev.session);
      });

      // responsiveness
      function onWindowResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
      window.addEventListener("resize", onWindowResize);

      // expose cleanup
      return () => {
        window.removeEventListener("resize", onWindowResize);
        if (renderer && renderer.domElement && containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
        if (containerRef.current) {
          // remove AR button if exists
          const btn = containerRef.current.querySelector(".ar-button, button");
          if (btn) btn.remove();
        }
        if (renderer) renderer.dispose();
        mounted = false;
      };
    } // end init

    // check WebXR support quickly
    (async () => {
      if (typeof navigator !== "undefined" && (navigator as any).xr) {
        try {
          const xr: any = (navigator as any).xr;
          const supported = await xr.isSessionSupported("immersive-ar");
          console.log(xr);
          
          setIsSupported(!!supported);
        } catch (e) {
          setIsSupported(false);
        }
      } else {
        setIsSupported(false);
      }

      const cleanup = await init();
      // cleanup returned by init
      // @ts-ignore
      (window as any)._arCleanup = cleanup;
    })();

    return () => {
      // cleanup if any
      // @ts-ignore
      if ((window as any)._arCleanup) {
        // @ts-ignore
        (window as any)._arCleanup();
      }
    };
  }, [modelUrl]);

  // simple UI controls (scale / rotate) after placed
  function increaseScale() {
    setScale((s) => {
      const ns = +(s + 0.05).toFixed(2);
      // update rug scale in scene if exists (best-effort)
      try {
        // @ts-ignore
        const THREE = (window as any).THREE;
        // nothing more here — main scale sync after placement occurs when placing
      } catch {}
      return ns;
    });
  }
  function decreaseScale() {
    setScale((s) => +(Math.max(0.05, s - 0.05)).toFixed(2));
  }
  function rotateLeft() {
    setRotationDeg((d) => d - 15);
  }
  function rotateRight() {
    setRotationDeg((d) => d + 15);
  }

  // Note: scale/rotation state will only affect model when placed (on select handler we applied rotation/state).
  // For a more reactive update you could keep reference to rug and update its scale/rotation on change.

  return (
    <div className={`relative w-full h-[600px] bg-black ${className || ""}`} ref={containerRef}>
      {isSupported === false && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-white">
          <p className="mb-2">دستگاه یا مرورگر شما WebXR را پشتیبانی نمی‌کند.</p>
          <p className="text-sm opacity-80">
            برای تست AR از Chrome (Android) با پشتیبانی WebXR استفاده کنید یا از نسخهٔ 3D معمولی / درخواست نمونه استفاده کنید.
          </p>
        </div>
      )}

      {/* Small controls shown after placed */}
      <div className="absolute left-4 top-4 flex flex-col gap-2 z-50">
        <button
          onClick={increaseScale}
          className="px-3 py-2 rounded bg-white/90 text-sm"
          title="بزرگ‌تر"
        >
          بزرگ‌تر
        </button>
        <button
          onClick={decreaseScale}
          className="px-3 py-2 rounded bg-white/90 text-sm"
          title="کوچک‌تر"
        >
          کوچک‌تر
        </button>
        <button
          onClick={rotateLeft}
          className="px-3 py-2 rounded bg-white/90 text-sm"
          title="چرخش CCW"
        >
          ←
        </button>
        <button
          onClick={rotateRight}
          className="px-3 py-2 rounded bg-white/90 text-sm"
          title="چرخش CW"
        >
          →
        </button>
      </div>

      {/* placed badge */}
      {placed && (
        <div className="absolute right-4 top-4 bg-green-600 text-white px-3 py-1 rounded z-50 text-sm">
          فرش قرار گرفت
        </div>
      )}

      {/* fallback link to model-viewer for non-WebXR */}
      {isSupported === false && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <a
            href={modelUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded bg-white text-black"
          >
            مشاهدهٔ مدل 3D
          </a>
        </div>
      )}
    </div>
  );
}
