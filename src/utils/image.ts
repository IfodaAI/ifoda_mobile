export async function resizeImageIfNeeded(
  file: File,
  options?: { maxDim?: number; quality?: number; outputType?: string }
): Promise<File> {
  const maxDim = options?.maxDim ?? 1600
  const quality = options?.quality ?? 0.82
  const outputType = options?.outputType ?? 'image/jpeg'

  // Only try to resize images we can decode in browser/webview
  if (!file.type.startsWith('image/')) return file

  // If already small enough, keep original
  if (file.size < 900 * 1024) return file

  const imgUrl = URL.createObjectURL(file)
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const scale = Math.min(1, maxDim / Math.max(width, height))
    if (scale >= 1) return file

    const outW = Math.max(1, Math.round(width * scale))
    const outH = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, outW, outH)

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        outputType,
        quality
      )
    })
    if (!blob) return file

    // If resize didn't help, keep original
    if (blob.size >= file.size) return file

    const ext = outputType.includes('png') ? 'png' : 'jpg'
    return new File([blob], `photo_${outW}x${outH}.${ext}`, { type: outputType })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}

