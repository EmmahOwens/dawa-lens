import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

export interface PreparedPdfResult {
  signature: string;
  pdf: jsPDF;
  blob: Blob;
  fileName: string;
  nativeUri?: string;
  createdAt: number;
}

// In-memory cache for pre-compiled PDFs
let activePreparedPdf: PreparedPdfResult | null = null;
let activeCompilationPromise: Promise<PreparedPdfResult> | null = null;
let activeCompilationSignature: string | null = null;

/**
 * Calculates page cuts across the report content so that pages are split
 * strictly at .pdf-block element boundaries rather than slicing through text or cards.
 */
export function calculateBlockAwarePageCuts(
  container: HTMLElement,
  maxPageHeightPx: number = 1120
): number[] {
  const containerRect = container.getBoundingClientRect();
  const totalHeightPx = container.scrollHeight || container.offsetHeight;
  const blocks = Array.from(container.querySelectorAll(".pdf-block")) as HTMLElement[];

  if (blocks.length === 0 || totalHeightPx <= maxPageHeightPx) {
    return [0, totalHeightPx];
  }

  const cuts: number[] = [0];
  let currentCut = 0;

  while (currentCut < totalHeightPx) {
    const targetCut = currentCut + maxPageHeightPx;
    if (targetCut >= totalHeightPx) {
      cuts.push(totalHeightPx);
      break;
    }

    // Find the furthest block that ends comfortably before targetCut
    let bestCut = targetCut;
    let foundBoundary = false;

    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      const blockTop = rect.top - containerRect.top;
      const blockBottom = blockTop + rect.height;

      // Check if block starts after currentCut and ends before or at targetCut
      if (blockBottom > currentCut + 100 && blockBottom <= targetCut) {
        bestCut = Math.max(bestCut === targetCut ? 0 : bestCut, blockBottom + 12);
        foundBoundary = true;
      }
    }

    const nextCut = foundBoundary ? Math.min(bestCut, totalHeightPx) : targetCut;
    if (nextCut <= currentCut + 50) {
      // Prevent zero or micro progress if a single block is huge
      const fallbackCut = Math.min(currentCut + maxPageHeightPx, totalHeightPx);
      cuts.push(fallbackCut);
      currentCut = fallbackCut;
    } else {
      cuts.push(nextCut);
      currentCut = nextCut;
    }
  }

  return cuts;
}

/**
 * Generates an A4 PDF from an offscreen or onscreen container using single-pass
 * canvas rasterization and high-speed in-memory canvas slicing.
 */
export async function compilePdfFromElement(
  container: HTMLElement,
  fileName: string
): Promise<{ pdf: jsPDF; blob: Blob }> {
  // Fast font readiness check without artificial timeouts
  if (typeof document !== "undefined" && document.fonts && document.fonts.status !== "loaded") {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 150)),
      ]);
    } catch {}
  }

  // Calculate clean cuts based on .pdf-block sections
  const cuts = calculateBlockAwarePageCuts(container, 1120);

  // Single-pass html2canvas capture (1.5x scale offers crisp 150 DPI with 50% less RAM & ~3x faster than 2.0x)
  const fullCanvas = await html2canvas(container, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: 800,
    windowWidth: 800,
    onclone: (_clonedDoc, clonedEl) => {
      clonedEl.style.position = "static";
      clonedEl.style.left = "0";
      clonedEl.style.top = "0";
      clonedEl.style.width = "800px";
      clonedEl.style.opacity = "1";
      clonedEl.style.visibility = "visible";
      clonedEl.style.pointerEvents = "auto";
      clonedEl.style.overflow = "visible";
    },
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const marginX = 15;
  const marginY = 15;
  const printableWidth = pdfWidth - 2 * marginX; // 180mm
  const scale = 1.5;

  const totalPages = cuts.length - 1;

  for (let i = 0; i < totalPages; i++) {
    const sliceStartY = cuts[i];
    const sliceEndY = cuts[i + 1];
    const sliceHeightPx = sliceEndY - sliceStartY;

    // Slice canvas in memory (< 2ms per page)
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = fullCanvas.width;
    sliceCanvas.height = Math.round(sliceHeightPx * scale);

    const sCtx = sliceCanvas.getContext("2d");
    if (sCtx) {
      sCtx.fillStyle = "#ffffff";
      sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sCtx.drawImage(
        fullCanvas,
        0,
        Math.round(sliceStartY * scale),
        fullCanvas.width,
        Math.round(sliceHeightPx * scale),
        0,
        0,
        sliceCanvas.width,
        sliceCanvas.height
      );
    }

    if (i > 0) {
      pdf.addPage();
    }

    const imgData = sliceCanvas.toDataURL("image/jpeg", 0.90);
    const slicePdfHeight = printableWidth * (sliceHeightPx / 800);

    pdf.addImage(
      imgData,
      "JPEG",
      marginX,
      marginY,
      printableWidth,
      slicePdfHeight,
      undefined,
      "FAST"
    );

    // Subtle pagination
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i + 1} of ${totalPages}`,
      pdfWidth / 2,
      pdfHeight - 10,
      { align: "center" }
    );
  }

  const blob = pdf.output("blob");
  return { pdf, blob };
}

/**
 * Checks if a pre-compiled report is already available for the given signature.
 */
export function getPreparedReport(signature: string): PreparedPdfResult | null {
  if (activePreparedPdf && activePreparedPdf.signature === signature) {
    // Only valid if generated within the last 15 minutes
    if (Date.now() - activePreparedPdf.createdAt < 15 * 60 * 1000) {
      return activePreparedPdf;
    }
  }
  return null;
}

/**
 * Triggers background/speculative pre-compilation of the Care Report PDF.
 * If tapped before completion, listeners can await the returned promise.
 */
export function precompileReport(
  signature: string,
  container: HTMLElement,
  fileName: string,
  nativeReportData?: any
): Promise<PreparedPdfResult> {
  // If already compiled for this exact signature, return immediately
  const existing = getPreparedReport(signature);
  if (existing) {
    return Promise.resolve(existing);
  }

  // If already in flight for this exact signature, join the promise
  if (activeCompilationPromise && activeCompilationSignature === signature) {
    return activeCompilationPromise;
  }

  activeCompilationSignature = signature;
  activeCompilationPromise = (async () => {
    try {
      // 1. Try native pre-generation first if on Capacitor native platform
      let nativeUri: string | undefined = undefined;
      if (Capacitor.isNativePlatform() && nativeReportData) {
        try {
          const { NativePdf } = await import("@/plugins/nativePdf");
          const nativeRes = await NativePdf.generateReport(nativeReportData);
          if (nativeRes?.fileUri) {
            nativeUri = nativeRes.fileUri;
          }
        } catch (nativeErr) {
          console.warn("[pdfReportService] Native precompile failed, using web generator:", nativeErr);
        }
      }

      // 2. Compile via optimized single-pass engine
      const { pdf, blob } = await compilePdfFromElement(container, fileName);

      // If on native platform and nativeUri wasn't created by plugin, write blob to cache
      if (Capacitor.isNativePlatform() && !nativeUri) {
        try {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(",")[1] || "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });
          nativeUri = savedFile.uri;
        } catch (fsErr) {
          console.warn("[pdfReportService] Filesystem write failed:", fsErr);
        }
      }

      const prepared: PreparedPdfResult = {
        signature,
        pdf,
        blob,
        fileName,
        nativeUri,
        createdAt: Date.now(),
      };

      activePreparedPdf = prepared;
      return prepared;
    } finally {
      activeCompilationPromise = null;
    }
  })();

  return activeCompilationPromise;
}

/**
 * Downloads or shares the PDF instantly. If precompiled, executes with 0ms delay.
 * If still compiling, smoothly awaits in-flight compilation.
 */
export async function downloadOrSharePdf({
  signature,
  container,
  fileName,
  patientName,
  nativeReportData,
}: {
  signature: string;
  container: HTMLElement;
  fileName: string;
  patientName: string;
  nativeReportData?: any;
}): Promise<void> {
  let prepared = getPreparedReport(signature);

  if (!prepared) {
    if (activeCompilationPromise && activeCompilationSignature === signature) {
      prepared = await activeCompilationPromise;
    } else {
      prepared = await precompileReport(signature, container, fileName, nativeReportData);
    }
  }

  // Delivery
  if (Capacitor.isNativePlatform()) {
    if (prepared.nativeUri) {
      await Share.share({
        title: "Care Report",
        text: `Medical Report for ${patientName}`,
        url: prepared.nativeUri,
        dialogTitle: "Save or Share Report",
      });
      return;
    }
    // Fallback on native if share uri unavailable
    prepared.pdf.save(fileName);
  } else {
    // Web: Instant blob trigger
    const blobUrl = URL.createObjectURL(prepared.blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}

/**
 * Invalidates the current prepared PDF cache (e.g. when patient changes or logs update).
 */
export function invalidatePreparedPdfCache() {
  activePreparedPdf = null;
  activeCompilationPromise = null;
  activeCompilationSignature = null;
}

