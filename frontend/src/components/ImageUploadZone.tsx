import { useCallback, useRef } from "react";
import { Upload, X, ImageIcon } from "lucide-react";

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
  max?: number;
}

const ImageUploadZone = ({ files, onFilesChange, max = 3 }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      onFilesChange([...files, ...dropped].slice(0, max));
    },
    [files, onFilesChange, max]
  );

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const selected = Array.from(e.target.files);
      onFilesChange([...files, ...selected].slice(0, max));
    },
    [files, onFilesChange, max]
  );

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">
          Drag & drop up to {max} photos, or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Clear face shots work best for matching
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleSelect}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4 max-h-[260px] overflow-y-auto p-2 rounded-xl bg-muted/20 border border-border/50">
          {files.map((file, i) => (
            <div key={i} className="relative group">
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Upload ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUploadZone;
