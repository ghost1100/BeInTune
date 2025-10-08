import React from "react";

export default function Lightbox({
  src,
  mime,
  onClose,
}: {
  src: string | null;
  mime?: string | null;
  onClose: () => void;
}) {
  if (!src) return null;
  const isVideo = mime
    ? mime.startsWith("video")
    : src.match(/\.(mp4|webm|mov|mkv|avi)$/i);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative max-w-3xl w-full max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute left-2 top-2 z-10 rounded bg-white/90 text-black px-2 py-1 font-semibold"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="w-full h-full flex items-center justify-center">
          {isVideo ? (
            <video
              src={src}
              controls
              className="max-h-[90vh] w-full object-contain"
            />
          ) : (
            <img
              src={src}
              alt="preview"
              className="max-h-[90vh] w-full object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}
