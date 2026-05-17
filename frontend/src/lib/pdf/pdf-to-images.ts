import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export interface PdfToImagesOptions {
  /** Scale factor for rendering. 1.0 = 72 DPI, 2.0 = 144 DPI. Default: 2.0 */
  scale?: number
}

export interface PageImage {
  pageNumber: number
  blob: Blob
  width: number
  height: number
}

/**
 * Convert a PDF to an array of images, one per page.
 */
export async function pdfToImages(
  pdfData: ArrayBuffer,
  options: PdfToImagesOptions = {}
): Promise<PageImage[]> {
  const { scale = 2.0 } = options

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise
  const images: PageImage[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to get canvas 2D context')
    }

    await page.render({ canvasContext: context, viewport }).promise

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b)
        else reject(new Error(`Failed to convert page ${pageNumber} to blob`))
      }, 'image/png')
    })

    images.push({
      pageNumber,
      blob,
      width: viewport.width,
      height: viewport.height,
    })

    page.cleanup()
  }

  pdf.destroy()
  return images
}

/**
 * Convert a PDF to an array of base64 data URLs, one per page.
 */
export async function pdfToDataUrls(
  pdfData: ArrayBuffer,
  options: PdfToImagesOptions = {}
): Promise<string[]> {
  const images = await pdfToImages(pdfData, options)
  return Promise.all(images.map((img) => blobToDataUrl(img.blob)))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'))
    reader.readAsDataURL(blob)
  })
}
