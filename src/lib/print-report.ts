/** Suppress browser print header title (e.g. app name) while printing. */
let savedDocumentTitle = "";

function handleBeforePrint() {
  savedDocumentTitle = document.title;
  document.title = " ";
}

function handleAfterPrint() {
  if (savedDocumentTitle) {
    document.title = savedDocumentTitle;
    savedDocumentTitle = "";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeprint", handleBeforePrint);
  window.addEventListener("afterprint", handleAfterPrint);
}

/** Opens the system print dialog with browser header title minimized. */
export function printReport() {
  window.print();
}
