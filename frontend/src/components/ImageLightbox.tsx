import { X, ChevronLeft, ChevronRight, Download, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaItem {
  id: string;
  fileName: string;
  similarity: number;
  type: "image" | "video";
  url: string;
  downloadUrl: string;
  date: string;
}

interface ImageLightboxProps {
  items: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const ImageLightbox = ({ items, currentIndex, onClose, onNavigate }: ImageLightboxProps) => {
  const item = items[currentIndex];
  if (!item) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
    if (e.key === "ArrowRight" && currentIndex < items.length - 1) onNavigate(currentIndex + 1);
  };

  const handleDownload = () => {
    window.open(item.downloadUrl, "_blank");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/80 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        className="relative max-w-4xl w-full mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-background hover:text-background/80"
          onClick={onClose}
        >
          <X className="w-6 h-6" />
        </Button>

        {/* Main preview — real image */}
        <div className="rounded-2xl overflow-hidden aspect-video flex items-center justify-center bg-muted">
          {item.url ? (
            <img
              src={item.url}
              alt={item.fileName}
              className="w-full h-full object-contain"
            />
          ) : (
            <Camera className="w-20 h-20 text-foreground/15" />
          )}
        </div>

        {/* Info bar */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-background font-display font-semibold text-lg">{item.fileName}</p>
            <p className="text-background/60 text-sm">
              {item.similarity}% match
              {currentIndex + 1} of {items.length}
            </p>
          </div>
          <Button
            size="sm"
            className="gradient-primary text-primary-foreground gap-2"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4" /> Download
          </Button>
        </div>

        {/* Nav arrows */}
        {currentIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-[-56px] top-1/2 -translate-y-1/2 text-background hover:text-background/80"
            onClick={() => onNavigate(currentIndex - 1)}
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
        )}
        {currentIndex < items.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-[-56px] top-1/2 -translate-y-1/2 text-background hover:text-background/80"
            onClick={() => onNavigate(currentIndex + 1)}
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ImageLightbox;
