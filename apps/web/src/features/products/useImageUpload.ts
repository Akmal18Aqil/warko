import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "../../locales/id";
import { compressImageFile } from "./imageCompression";

/** Picks a photo from the device (file dialog, camera or drag & drop), compresses it and reports the data URL. */
export function useImageUpload(onImage: (dataUrl: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const openDialog = () => inputRef.current?.click();

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t.products.picker.upload.unsupportedFormat);
      return;
    }
    setProcessing(true);
    try {
      toast.info(t.products.picker.upload.compressing);
      onImage(await compressImageFile(file));
      toast.success(t.products.picker.upload.success);
    } catch {
      toast.error(t.products.picker.upload.failed);
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  };

  return { inputRef, processing, openDialog, processFile, onInputChange };
}
