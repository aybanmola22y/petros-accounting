type XlsxGlobal = {
  read: (data: ArrayBuffer | Uint8Array, opts: { type: string; cellDates?: boolean }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: <T>(sheet: unknown, opts: { header: 1; defval: string; blankrows: boolean }) => T[][];
  };
};

declare global {
  interface Window {
    XLSX?: XlsxGlobal;
  }
}

let loadPromise: Promise<XlsxGlobal> | null = null;

export function loadXlsx(): Promise<XlsxGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Spreadsheet parsing is only available in the browser."));
  }
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-xlsx-vendor="true"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.XLSX) resolve(window.XLSX);
        else reject(new Error("Failed to load spreadsheet parser."));
      });
      existing.addEventListener("error", () => reject(new Error("Failed to load spreadsheet parser.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "/vendor/xlsx.full.min.js";
    script.async = true;
    script.dataset.xlsxVendor = "true";
    script.onload = () => {
      if (window.XLSX) resolve(window.XLSX);
      else reject(new Error("Failed to load spreadsheet parser."));
    };
    script.onerror = () => reject(new Error("Failed to load spreadsheet parser."));
    document.head.appendChild(script);
  });

  return loadPromise;
}
