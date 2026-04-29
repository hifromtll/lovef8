'use client';

type MediaLightboxProps = {
  imageUrl: string | null;
  onClose: () => void;
};

export default function MediaLightbox({
  imageUrl,
  onClose,
}: MediaLightboxProps) {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm font-bold text-black"
      >
        Close
      </button>

      <img
        src={imageUrl}
        alt="Saved journal media"
        className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}