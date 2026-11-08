# Applies the screenshot/receipt import changes to Rent Roll.
# Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\apply-receipt-import.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$app  = Join-Path $root "app\components\rent-roll\RentRollApp.tsx"
$css  = Join-Path $root "app\global.css"

foreach ($f in @($app, $css)) {
  if (-not (Test-Path $f)) { Write-Host "MISSING: $f"; exit 1 }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $app "$app.bak-$stamp" -Force
Copy-Item $css "$css.bak-$stamp" -Force
Write-Host "Backups created with suffix .bak-$stamp"
Write-Host ""

function Edit-File($path, $label, $old, $new) {
  $text = [System.IO.File]::ReadAllText($path)
  $count = ([regex]::Matches($text, [regex]::Escape($old))).Count
  if ($count -ne 1) {
    Write-Host "SKIP      $label  (found $count matches, expected 1)"
    return
  }
  $text = $text.Replace($old, $new)
  [System.IO.File]::WriteAllText($path, $text)
  Write-Host "APPLIED   $label"
}

$addedImport = @'
import { isImageFile, readReceipt, type ReceiptDraft } from "../../lib/receipt-ocr.js";
'@
$addedState = @'
  const [receipt, setReceipt] = useState<ReceiptDraft | null>(null);
  const [readingImage, setReadingImage] = useState(false);
'@
$newHandlers = @'
  const importReceiptDraft = async () => {
    if (!receipt) return;
    if (receipt.amountCents <= 0) throw new Error("Add an amount greater than zero before saving this receipt.");
    const rows = [{ date: parseIsoDate(receipt.date), description: receipt.description.trim() || "Tenant transfer", amountCents: receipt.amountCents }];
    const result = await importMutation.mutateAsync({ bankName: receipt.fileName.replace(/\.[^.]+$/, "") || "Receipt screenshot", rows });
    setNotice(`${result.importedCount} payment imported from the screenshot, ${result.skippedCount} already imported and skipped.`);
    setReceipt(null);
  };
  const readReceiptFile = async (file: File) => {
    try {
      setReadingImage(true);
      const draft = await readReceipt(file, getTodayIsoDate(timezone));
      setReceipt(draft);
    }
    catch (error) {
      errorToast(error, "Could not read that screenshot. Check the date and amount, or use a CSV.");
    }
    finally {
      setReadingImage(false);
      setActiveImport(false);
    }
  };
  const startImport = (file?: File) => {
    if (!file) return;
    if (isImageFile(file)) {
      setMapping(null);
      setActiveImport(true);
      void readReceiptFile(file);
      return;
    }
    setReceipt(null);
    setActiveImport(true);
    void importFile(file).catch((error) => { errorToast(error, "Could not import that statement. Check the CSV columns and try again."); setActiveImport(false); });
  };
'@
$reviewPanel = @'
{receipt && <section className="panel mapping-panel"><div><span className="eyebrow">CHECK THIS RECEIPT</span><h2>We read this from the screenshot</h2><p>Fix anything that looks wrong, then save it as a payment. Nothing is saved yet, and the image never leaves your device.</p></div><div className="mapping-fields"><label>Date<input className={textInput} value={receipt.date} onChange={(event) => setReceipt({ ...receipt, date: event.target.value })} /></label><label>Amount<input className={textInput} inputMode="decimal" value={(receipt.amountCents / 100).toFixed(2)} onChange={(event) => { const cents = Math.round(Number(event.target.value.replace(/[^\d.]/g, "")) * 100); setReceipt({ ...receipt, amountCents: Number.isFinite(cents) && cents > 0 ? cents : 0 }); }} /></label><label>Description<input className={textInput} value={receipt.description} onChange={(event) => setReceipt({ ...receipt, description: event.target.value })} /></label></div><details className="ocr-raw"><summary>What we read from the image ({Math.round(receipt.confidence * 100)}% confidence)</summary><pre>{receipt.rawText}</pre></details><Button className="button-primary" onClick={() => void importReceiptDraft().catch((error) => errorToast(error, "Could not save that receipt."))}>Looks right</Button><button className="quiet-link" onClick={() => setReceipt(null)}>Cancel</button></section>}
'@
$ocrStyles = @'
.ocr-raw { border: 1px solid var(--line); border-radius: 7px; background: #faf8f4; padding: 8px 10px; }
.ocr-raw summary { cursor: pointer; color: #625c53; font-size: 10px; font-weight: 600; }
.ocr-raw pre { max-height: 190px; overflow: auto; margin: 9px 0 0; color: #5f5a52; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; line-height: 1.5; white-space: pre-wrap; }
'@

$oldImport = 'import { getTodayIsoDate, getWeekStartDate, parseCsv, parseIsoDate, parseMoneyCents, formatCents } from "../../../shared/rent-roll.js";'
Edit-File $app "1. import line" $oldImport ($oldImport + "`n" + $addedImport)

$oldState = '  const [mapping, setMapping] = useState<{ fileName: string; rows: string[][]; headers: string[]; dateIndex: number; descIndex: number; amountIndex: number } | null>(null);'
Edit-File $app "2. receipt state" $oldState ($oldState + "`n" + $addedState)

$oldHandlers = @'
  const startImport = (file?: File) => {
    if (!file) return;
    setActiveImport(true);
    void importFile(file).catch((error) => { errorToast(error, "Could not import that statement. Check the CSV columns and try again."); setActiveImport(false); });
  };
'@
Edit-File $app "3. import handlers" $oldHandlers $newHandlers

$oldAnchor = '{mapping && <section className="panel mapping-panel"><div><span className="eyebrow">CHECK YOUR COLUMNS</span>'
Edit-File $app "4. review panel" $oldAnchor ($reviewPanel + "`n" + $oldAnchor)

Edit-File $app "5a. accept images (main input)" 'accept=".csv,text/csv"' 'accept=".csv,text/csv,image/png,image/jpeg"'
Edit-File $app "5b. accept images (hidden input)" 'accept=".csv"' 'accept=".csv,text/csv,image/png,image/jpeg"'

Edit-File $app "6. empty-state copy" '<p>Upload a CSV with date, description, and amount columns. Only money-in rows are used.</p>' '<p>Upload a CSV with date, description, and amount columns, or drop a screenshot (PNG or JPG) of a tenant’s transfer receipt. Only money-in rows are used.</p>'

Edit-File $app "7. progress indicator" '{activeImport && <span className="inline-notice">Importing statement…</span>}' '{readingImage ? <span className="inline-notice">Reading the screenshot…</span> : activeImport && <span className="inline-notice">Importing statement…</span>}'

Edit-File $app "8. pass timezone" 'notice={importNotice} setNotice={setImportNotice} onManualPayment={() => setShowAddPayment(true)} />' 'notice={importNotice} setNotice={setImportNotice} timezone={prefs?.timezone ?? "Africa/Lagos"} onManualPayment={() => setShowAddPayment(true)} />'

Edit-File $app "9. screen signature" 'function PaymentsScreen({ payments, imports, units, money, notice, setNotice, onManualPayment }: any) {' 'function PaymentsScreen({ payments, imports, units, money, notice, setNotice, onManualPayment, timezone = "Africa/Lagos" }: any) {'

$oldCss = '.mapping-preview { overflow: hidden; border: 1px solid var(--line); border-radius: 7px; background: #faf8f4; padding: 7px 10px; }'
Edit-File $css "10. ocr styles" $oldCss ($ocrStyles + "`n" + $oldCss)

Write-Host ""
Write-Host "Done. Restart the dev server, then open Payments -> Import statement."
