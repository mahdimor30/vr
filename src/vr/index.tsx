"use client";

import { useState, useEffect } from "react";

const carpets = [
  {
    id: 1,
    name: "فرش سنتی کرمان",
    image: "/preview-images/carpet1.jpg",
    model: "/models/test.glb",
    iosModel: "/models/.usdz",
  },
 
];

export default function Page() {
  const [selected, setSelected] = useState(carpets[0]);

  useEffect(() => {
    // load <model-viewer> script once
    const script = document.createElement("script");
    script.type = "module";
    script.src =
      "https://ajax.googleapis.com/ajax/libs/model-viewer/3.0.1/model-viewer.min.js";
    document.head.appendChild(script);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        پیش‌نمایش فرش در اتاق شما 🏠
      </h1>

      {/* لیست انتخاب فرش */}
      <div className="flex gap-4 mb-8 overflow-x-auto">
        {carpets.map((carpet) => (
          <div
            key={carpet.id}
            onClick={() => setSelected(carpet)}
            className={`cursor-pointer border-2 rounded-xl overflow-hidden ${
              selected.id === carpet.id
                ? "border-blue-500"
                : "border-transparent"
            }`}
          >
            <img
              src={carpet.image}
              alt={carpet.name}
              className="w-32 h-32 object-cover"
            />
            <p className="text-center text-sm py-1">{carpet.name}</p>
          </div>
        ))}
      </div>

      {/* مدل سه‌بعدی */}
      <model-viewer
        key={selected.id}
        // @ts-ignore – <model-viewer> is a custom element not in JSX.IntrinsicElements
        src={selected.model}
        ios-src={selected.iosModel}
        alt={selected.name}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        auto-rotate
        shadow-intensity="1"
        style={{
          width: "100%",
          maxWidth: "500px",
          height: "500px",
          background: "#eee",
          borderRadius: "1rem",
        }}
      ></model-viewer>

      <p className="text-gray-600 text-sm mt-4">
        برای مشاهده در اتاق خود، روی دکمه‌ی <b>“View in your space”</b> کلیک کنید.
      </p>
    </main>
  );
}
