import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  useActionMutation,
  useActionQuery,
  actionErrorMessage,
  writeClientAppState,
} from "@agent-native/core/client/hooks";
import { TAB_ID } from "@/lib/tab-id";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconCopy,
  IconCreditCard,
  IconDownload,
  IconFileUpload,
  IconHome,
  IconLayoutDashboard,
  IconMessageCircle,
  IconPlus,
  IconSettings,
  IconSparkles,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getTodayIsoDate, getWeekStartDate, parseCsv, parseIsoDate, parseMoneyCents, formatCents } from "../../../shared/rent-roll.js";

type Unit = {
  id: string;
  property: string;
  unitLabel: string;
  tenantName: string;
  tenantEmail: string;
  notes: string;
  rentCents: number;
  paidCents: number;
  dueDate: string;
  leaseEnd: string;
};

type Settings = {
  id: string;
  landlordName: string;
  currencySymbol: string;
  dateFormat: string;
  timezone: string;
  weekStart: "Monday" | "Sunday";
  autoMatch: boolean;
  friendlyDays: number;
  firmDays: number;
  formalDays: number;
  friendlyTemplate: string;
  firmTemplate: string;
  formalTemplate: string;
  scheduleEnabled: boolean;
  weeklyNote: string;
  lastPreparedAt: string;
};

const navigation = [
  { label: "Today", icon: IconLayoutDashboard },
  { label: "Rent Roll", icon: IconHome },
  { label: "Payments", icon: IconCreditCard },
  { label: "Messages", icon: IconMessageCircle },
  { label: "Properties", icon: IconBuilding },
  { label: "Settings", icon: IconSettings },
];

const textInput = "rr-input";

function openAssistant() {
  window.dispatchEvent(new CustomEvent("agent-panel:open", { detail: { focus: true } }));
}

function errorToast(error: unknown, fallback: string) {
  toast.error(actionErrorMessage(error) ?? fallback);
}

export function RentRollApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = navigation.find((item) => item.label.toLowerCase().replace(/ /g, "-") === searchParams.get("view"))?.label ?? "Today";
  const [showAssistantNotice, setShowAssistantNotice] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [selectedCell, setSelectedCell] = useState<Unit | null>(null);
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const { data: unitsData = [], isLoading: unitsLoading } = useActionQuery("list-rent-roll", { limit: 300 });
  const { data: brief } = useActionQuery("get-brief-data", {});
  const { data: settings } = useActionQuery("get-rent-settings", {});
  const { data: payments = [] } = useActionQuery("list-bank-transactions", { status: "all", limit: 100 });
  const { data: imports = [] } = useActionQuery("list-bank-imports", {});
  const { data: reminders = [] } = useActionQuery("list-reminders", {});
  const { data: activity = [] } = useActionQuery("list-activity", {});
  const { data: repairs = [] } = useActionQuery("list-repair-requests", {});
  const { data: leaseHistory = [] } = useActionQuery("list-lease-history", {});
  const undoPaymentMutation = useActionMutation("undo-payment");
  const units = unitsData as Unit[];
  const prefs = settings as Settings | undefined;
  const today = getTodayIsoDate(prefs?.timezone ?? "America/Los_Angeles");
  const currentMonth = today.slice(0, 7);
  const weekStart = getWeekStartDate(today, prefs?.weekStart ?? "Monday");
  const weekLabel = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${weekStart}T00:00:00Z`));
  const month = monthOverride ?? currentMonth;
  const { data: rentGrid, isLoading: gridLoading } = useActionQuery("get-rent-roll-grid", { month });
  const selectedNav = (view: string) => {
    const key = view.toLowerCase().replace(/ /g, "-");
    setSearchParams(view === "Today" ? {} : { view: key });
    setSelectedCell(null);
    void writeClientAppState("navigation", { view: key, label: view }, { requestSource: TAB_ID });
  };
  const selectUnit = (unit: Unit) => {
    setSelectedCell(unit);
    void writeClientAppState("navigation", { view: "rent-roll", label: "Rent Roll", selectedUnitId: unit.id }, { requestSource: TAB_ID });
  };
  const money = (cents: number) => formatCents(cents, prefs?.currencySymbol ?? "$", false);
  const prepareWeek = () => {
    setShowAssistantNotice(false);
    sendToAgentChat({
      chatTarget: "local",
      message: "Prepare my Monday rent brief. Read get-brief-data, review the late rents, upcoming leases, and recent activity, then save a concise two- or three-sentence note with save-brief. Never calculate or state balances yourself; use the values returned by get-brief-data. Do not send messages or move money.",
      context: JSON.stringify({ view: "today", unitCount: units.length }),
      submit: true,
      openSidebar: true,
    });
  };

  return (
    <div className="rent-app min-h-screen">
      <Toaster position="bottom-right" />
      <aside className="rent-sidebar">
        <div className="brand"><span className="brand-mark"><IconHome size={19} /></span>Rent Roll</div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => selectedNav(label)}><Icon size={19} stroke={1.7} /><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="note-icon"><IconSparkles size={16} /></span><div><strong>Your week, made lighter.</strong><p>Know what needs you, and what doesn’t.</p></div></div>
          <button className="assistant-sidebar-button" onClick={openAssistant}><IconMessageCircle size={16} /> Ask the assistant</button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar"><div className="breadcrumb">Workspace <IconChevronRight size={14} /> <span>{active}</span></div><div className="topbar-actions"><span className="week-pill"><IconCalendar size={15} /> Week of {weekLabel}</span><button className="top-assistant" onClick={openAssistant}><IconMessageCircle size={17} /> Ask</button><span className="top-avatar" aria-label="Owner">●</span></div></header>
        <div className="content-wrap">
          {active === "Today" && <TodayScreen units={units} loading={unitsLoading} brief={brief} money={money} landlordName={prefs?.landlordName ?? ""} weekLabel={weekLabel} month={month} onNavigate={selectedNav} onPrepare={prepareWeek} onAddUnit={() => setShowAddUnit(true)} showHistory={showHistory} setShowHistory={setShowHistory} showAssistantNotice={showAssistantNotice} setShowAssistantNotice={setShowAssistantNotice} activity={activity} onUndo={(id: string) => void undoPayment(id)} />}
          {active === "Rent Roll" && <RentRollScreen grid={rentGrid} loading={gridLoading} month={month} setMonth={setMonthOverride} currentMonth={currentMonth} money={money} search={search} setSearch={setSearch} propertyFilter={propertyFilter} setPropertyFilter={setPropertyFilter} onAdd={() => setShowAddPayment(true)} onSelect={selectUnit} />}
          {active === "Payments" && <PaymentsScreen payments={payments} imports={imports} units={units} money={money} notice={importNotice} setNotice={setImportNotice} onManualPayment={() => setShowAddPayment(true)} />}
          {active === "Messages" && <MessagesScreen units={units} reminders={reminders} repairs={repairs} money={money} />}
          {active === "Properties" && <PropertiesScreen units={units} leaseHistory={leaseHistory} loading={unitsLoading} money={money} onAdd={() => setShowAddUnit(true)} />}
          {active === "Settings" && <SettingsScreen {...(prefs ? { settings: prefs } : {})} units={units} money={money} />}
        </div>
      </main>
      <AddUnitSheet open={showAddUnit} onOpenChange={setShowAddUnit} onSaved={() => setShowAddUnit(false)} />
      <AddPaymentSheet open={showAddPayment} units={units} onOpenChange={setShowAddPayment} onSaved={() => setShowAddPayment(false)} />
      <UnitDetailSheet unit={selectedCell} payments={payments.filter((payment: any) => payment.unitId === selectedCell?.id && payment.status === "matched")} onOpenChange={(open) => !open && setSelectedCell(null)} money={money} onMatch={() => setShowAddPayment(true)} onUndo={(id: string) => void undoPayment(id)} />
    </div>
  );

  async function undoPayment(transactionId: string) {
    try {
      await undoPaymentMutation.mutateAsync({ transactionId });
    } catch (error) {
      errorToast(error, "Could not undo that payment.");
    }
  }
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <section className="page-heading"><div><div className="eyebrow">RENT ROLL</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-actions">{action}</div>}</section>;
}

function TodayScreen({ units, loading, brief, money, landlordName, weekLabel, month, onNavigate, onPrepare, onAddUnit, showHistory, setShowHistory, showAssistantNotice, setShowAssistantNotice, activity, onUndo }: any) {
  const expected = brief?.expectedCents ?? units.reduce((sum: number, unit: Unit) => sum + unit.rentCents, 0);
  const collected = brief?.collectedCents ?? units.reduce((sum: number, unit: Unit) => sum + unit.paidCents, 0);
  const unpaidCount = (brief?.lateUnits?.length ?? 0) + (brief?.endingLeases?.length ?? 0);
  const pct = expected ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  if (!loading && units.length === 0) return <section className="welcome-panel"><span className="eyebrow">YOUR FIRST WEEK</span><h1>Let’s set up your first week</h1><p>Add a property, enter its units and tenants, then import a bank statement to start matching rent.</p><div className="welcome-steps"><div><i>1</i><span><strong>Add a property and its units</strong><small>Start with one home and unit.</small></span></div><div><i>2</i><span><strong>Add tenants and leases</strong><small>Keep rent and end dates in one place.</small></span></div><div><i>3</i><span><strong>Import a bank statement</strong><small>Review each suggested match.</small></span></div></div><Button className="button-primary" onClick={onAddUnit}><IconPlus size={16} /> Add your first unit</Button></section>;
  return <>
    <section className="page-heading"><div><div className="eyebrow">WEEK OF {weekLabel.toUpperCase()}</div><h1>Good morning{landlordName ? `, ${landlordName.split(" ")[0]}` : ""}</h1><p>Your Monday money check, at a glance.</p></div><div className="heading-actions"><span className="prepared-note"><IconClock size={15} /> {brief?.lastPreparedAt ? `Last prepared ${new Date(brief.lastPreparedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not prepared yet"}</span><Button className="button-primary" onClick={onPrepare}><IconSparkles size={17} /> Prepare my week</Button></div></section>
    <section className="money-strip"><div className="money-cell"><span>Expected this month</span><strong>{loading ? "—" : money(expected)}</strong><small><IconUsers size={14} /> {brief?.unitCount ?? 0} active units</small></div><div className="money-cell collected"><span>Collected</span><strong>{loading ? "—" : money(collected)}</strong><small><IconCircleCheck size={14} /> {brief?.paidCount ?? 0} of {units.length} paid in full</small></div><div className="money-cell owed"><span>Still owed</span><strong>{loading ? "—" : money(brief?.stillOwedCents ?? expected - collected)}</strong><small><IconArrowDownRight size={14} /> Across {units.length - (brief?.paidCount ?? 0)} payments</small></div><div className="progress-block"><div className="progress-caption"><span>Monthly collection</span><strong>{pct}%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div><small>{monthLabel(month)} rent</small></div></section>
    <div className="dashboard-grid"><section className="panel attention-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR ATTENTION</span><h2>Needs you <span className="heading-count">{unpaidCount}</span></h2></div><button className="text-link" onClick={() => onNavigate("Payments")}>View payments <IconArrowUpRight size={15} /></button></div><div className="attention-list">{brief?.lateUnits?.length ? <div className="attention-row"><div className="attention-icon late"><IconAlertCircle size={18} /></div><div className="attention-copy"><strong>{brief.lateUnits.length} {brief.lateUnits.length === 1 ? "rent is" : "rents are"} past due</strong><p>{money(brief.lateUnits.reduce((sum: number, unit: any) => sum + unit.balanceCents, 0))} still owed across your properties.</p></div><button className="row-action" onClick={() => onNavigate("Rent Roll")} aria-label="Review late rent"><IconChevronRight size={18} /></button></div> : null}{brief?.endingLeases?.length ? <div className="attention-row"><div className="attention-icon lease"><IconCalendar size={18} /></div><div className="attention-copy"><strong>{brief.endingLeases.length} {brief.endingLeases.length === 1 ? "lease is" : "leases are"} ending soon</strong><p>Review the lease end dates and plan ahead.</p></div><button className="row-action" onClick={() => onNavigate("Properties")} aria-label="Review leases"><IconChevronRight size={18} /></button></div> : null}{unpaidCount === 0 && <div className="attention-row"><div className="attention-icon lease"><IconCheck size={18} /></div><div className="attention-copy"><strong>You’re all caught up</strong><p>Nothing needs a decision right now.</p></div></div>}</div><div className="panel-footer"><span><IconCheck size={15} /> Rent totals are calculated from saved unit records.</span></div></section><section className="panel assistant-panel"><div className="assistant-top"><div className="assistant-orb"><IconSparkles size={19} /></div><span className="eyebrow">YOUR MONDAY NOTE</span></div><h2>{brief?.weeklyNote ? "A note for the week." : "Your week, in one clear view."}</h2><p>{showAssistantNotice ? "Connect an assistant to turn this on. Rent totals, payment matching, and template reminders work without an AI key." : brief?.weeklyNote || "Prepare a brief with the assistant. Your totals and payment status are ready to review."}</p><div className="assistant-signoff"><span className="assistant-line" /> <span>{brief?.weeklyNote ? "Saved assistant note" : "AI features need an assistant connection"}</span></div><button className="assistant-prompt" onClick={onPrepare}><span>Ask about your week</span><IconArrowUpRight size={16} /></button></section></div>
    <section className="panel rent-panel"><div className="panel-heading rent-heading"><div><span className="eyebrow">{monthLabel(month).toUpperCase()} OVERVIEW</span><h2>Rent at a glance</h2></div><button className="text-link" onClick={() => onNavigate("Rent Roll")}>Open rent roll <IconArrowUpRight size={15} /></button></div><UnitTable units={units.slice(0, 4)} money={money} loading={loading} /></section>
    <section className="history-wrap"><button className="history-toggle" onClick={() => setShowHistory(!showHistory)}><IconChevronDown size={16} className={showHistory ? "rotate" : ""} /><span>What changed this week</span></button>{showHistory && <div className="history-list">{activity.length ? activity.map((entry: any) => <div key={entry.id}><span className={`history-dot ${entry.undone ? "gold" : "green"}`} /><p><strong>{entry.description}</strong><small>{new Date(entry.createdAt).toLocaleString()}</small></p>{entry.transactionId && !entry.undone && <button onClick={() => onUndo(entry.transactionId)}>Undo</button>}</div>) : <p className="history-empty">Payment activity will appear here after a statement is imported.</p>}</div>}</section>
  </>;
}

function UnitTable({ units, money, loading, onSelect }: { units: Unit[]; money: (cents: number) => string; loading: boolean; onSelect?: (unit: Unit) => void }) {
  return <div className="table-scroll"><table className="rent-table"><thead><tr><th>UNIT & TENANT</th><th>PROPERTY</th><th>RENT</th><th>PAID</th><th>STATUS</th></tr></thead><tbody>{units.map((unit) => { const balance = unit.rentCents - unit.paidCents; const status = !unit.tenantName ? "Vacant" : balance <= 0 ? "Paid" : unit.paidCents > 0 ? "Part paid" : "Late"; return <tr key={unit.id} onClick={() => onSelect?.(unit)}><td><div className="unit-cell"><span className="unit-avatar">{unit.unitLabel}</span><span><strong>{unit.tenantName}</strong><small>{unit.unitLabel}</small></span></div></td><td>{unit.property}</td><td className="tabular">{money(unit.rentCents)}</td><td className="tabular">{money(unit.paidCents)}</td><td><span className={`status-chip ${status === "Paid" ? "status-paid" : status === "Part paid" ? "status-part" : status === "Vacant" ? "status-vacant" : "status-late"}`}><i>{status === "Paid" ? "✓" : status === "Part paid" ? "◐" : status === "Vacant" ? "–" : "!"}</i>{status}</span></td></tr>; })}{loading && <tr><td colSpan={5} className="empty-table">Loading your rent roll…</td></tr>}{!loading && units.length === 0 && <tr><td colSpan={5} className="empty-table">Add your first property to start your rent roll.</td></tr>}</tbody></table></div>;
}

function RentRollScreen({ grid, loading, month, setMonth, currentMonth, money, search, setSearch, propertyFilter, setPropertyFilter, onAdd, onSelect }: any) {
  const [statusFilter, setStatusFilter] = useState("All");
  const months: string[] = grid?.months ?? [];
  const units = (grid?.units ?? []) as Array<Unit & { cells: Array<{ month: string; paidCents: number; balanceCents: number; status: string }> }>;
  const properties = ["All", ...Array.from(new Set<string>(units.map((unit) => unit.property)))];
  const selectedMonth = units.flatMap((unit) => unit.cells).find((cell) => cell.month === month);
  const visible = units.filter((unit) => {
    const cell = unit.cells.find((item) => item.month === month);
    return (propertyFilter === "All" || unit.property === propertyFilter)
      && `${unit.unitLabel} ${unit.tenantName} ${unit.property}`.toLowerCase().includes(search.toLowerCase())
      && (statusFilter === "All" || cell?.status === statusFilter);
  });
  return <><PageHeader title="Rent Roll" description="Who has paid and who hasn’t." action={<Button className="button-primary" onClick={onAdd}><IconPlus size={16} /> Add a payment</Button>} /><div className="rent-filters">{["All", "Late", "Part paid", "Paid", "Upcoming", "Vacant"].map((item) => <button key={item} className={`filter-chip ${statusFilter === item ? "selected" : ""}`} onClick={() => setStatusFilter(item)}>{item}</button>)}<select className={textInput} value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)}>{properties.map((property: string) => <option key={property} value={property}>{property}</option>)}</select><input className={textInput} placeholder="Search units or tenants" value={search} onChange={(event) => setSearch(event.target.value)} /></div><section className="panel rent-panel"><div className="panel-heading rent-heading"><div><span className="eyebrow">SIX-MONTH OVERVIEW</span><h2>{visible.length} units</h2></div><div className="month-switcher"><button aria-label="Previous month" onClick={() => setMonth(shiftMonthLabel(month, -1))}>‹</button><button onClick={() => setMonth(null)}>This month</button><button aria-label="Next month" onClick={() => setMonth(shiftMonthLabel(month, 1))}>›</button></div></div><div className="rent-grid-scroll"><table className="rent-grid"><thead><tr><th>UNIT & TENANT</th>{months.map((value) => <th key={value}>{monthLabel(value)}</th>)}</tr></thead><tbody>{visible.map((unit) => <tr key={unit.id}><td><button className="grid-unit" onClick={() => { const cell = unit.cells.find((item) => item.month === month); onSelect({ ...unit, paidCents: cell?.paidCents ?? 0 }); }}><strong>{unit.unitLabel} · {unit.tenantName}</strong><small>{unit.property}</small></button></td>{unit.cells.map((cell) => <td key={cell.month}><button className={`grid-cell status-${cell.status.toLowerCase().replace(" ", "-")}`} onClick={() => onSelect({ ...unit, paidCents: cell.paidCents })} aria-label={`${unit.unitLabel} ${monthLabel(cell.month)}: ${cell.status}${cell.balanceCents ? `, ${money(cell.balanceCents)} still owed` : ""}`}><span>{cell.status === "Paid" ? "✓" : cell.status === "Part paid" ? "◐" : cell.status === "Late" ? "!" : "○"} {cell.status}</span>{cell.balanceCents > 0 && <small>{money(cell.balanceCents)}</small>}</button></td>)}</tr>)}{loading && <tr><td colSpan={months.length + 1} className="empty-table">Loading rent history…</td></tr>}{!loading && visible.length === 0 && <tr><td colSpan={months.length + 1} className="empty-table">No units match this filter.</td></tr>}</tbody><tfoot><tr><th>Expected</th>{months.map((value) => <th key={value}>{money(units.reduce((sum, unit) => sum + (unit.tenantName.trim() ? unit.rentCents : 0), 0))}</th>)}</tr><tr><th>Collected</th>{months.map((value) => <th key={value}>{money(units.reduce((sum, unit) => sum + (unit.cells.find((cell) => cell.month === value)?.paidCents ?? 0), 0))}</th>)}</tr></tfoot></table></div></section></>;
}

function shiftMonthLabel(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const absolute = (year ?? 2026) * 12 + (monthNumber ?? 1) - 1 + offset;
  return `${Math.floor(absolute / 12)}-${String((absolute % 12) + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(Date.UTC(year ?? 2026, (monthNumber ?? 1) - 1, 1)));
}

function PaymentsScreen({ payments, imports, units, money, notice, setNotice, onManualPayment }: any) {
  const [tab, setTab] = useState("matched");
  const [activeImport, setActiveImport] = useState(false);
  const importMutation = useActionMutation("import-bank-statement");
  const confirm = useActionMutation("confirm-payment-match");
  const exclude = useActionMutation("exclude-bank-payment");
  const undo = useActionMutation("undo-payment");
  const [candidateById, setCandidateById] = useState<Record<string, string>>({});
  const [mapping, setMapping] = useState<{ fileName: string; rows: string[][]; headers: string[]; dateIndex: number; descIndex: number; amountIndex: number } | null>(null);
  const tabs = ["matched", "suggested", "unplaced"];
  const filtered = payments.filter((payment: any) => payment.status === tab || (tab === "unplaced" && payment.status === "excluded"));
  const sample = "Date,Description,Amount\n2026-11-01,RENT WILLOW 1A,1850.00\n2026-11-01,RENT MAPLE 3B,900.00\n2026-11-01,ONLINE TRANSFER,1250.00";
  const importFile = async (file: File) => {
    const csv = parseCsv(await file.text());
    if (csv.length < 2 || !csv[0]) throw new Error("Add a CSV with a header row and at least one transaction.");
    const headers = csv[0];
    const header = headers.map((value) => value.toLowerCase());
    const dateIndex = header.findIndex((value) => value.includes("date"));
    const descIndex = header.findIndex((value) => value.includes("description") || value.includes("memo") || value.includes("reference"));
    const amountIndex = header.findIndex((value) => value.includes("amount") || value.includes("credit") || value.includes("deposit") || value.includes("money in"));
    setMapping({ fileName: file.name, rows: csv.slice(1), headers, dateIndex: Math.max(0, dateIndex), descIndex: Math.max(0, descIndex), amountIndex: Math.max(0, amountIndex) });
    setActiveImport(false);
  };
  const importMappedRows = async (fileName: string, sourceRows: string[][], columns: { dateIndex: number; descIndex: number; amountIndex: number }) => {
    const rows = sourceRows.flatMap((line) => {
      const description = line[columns.descIndex];
      if (!description) return [];
      const amountCents = parseMoneyCents(line[columns.amountIndex] ?? "");
      if (amountCents <= 0) return [];
      return [{ date: parseIsoDate(line[columns.dateIndex] ?? ""), description, amountCents }];
    });
    if (!rows.length) throw new Error("No positive money-in rows were found in this statement.");
    const result = await importMutation.mutateAsync({ bankName: fileName.replace(/\.csv$/i, "") || "Bank statement", rows });
    setNotice(`${result.importedCount} rows imported, ${result.skippedCount} already imported and skipped.`);
    setMapping(null);
    setActiveImport(false);
  };
  const startImport = (file?: File) => {
    if (!file) return;
    setActiveImport(true);
    void importFile(file).catch((error) => { errorToast(error, "Could not import that statement. Check the CSV columns and try again."); setActiveImport(false); });
  };
  const downloadSample = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([sample], { type: "text/csv" }));
    link.download = "rent-roll-sample.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return <><PageHeader title="Payments" description="Drop in your bank statement and I’ll match it." action={<div className="payment-heading-actions"><Button className="button-secondary" onClick={onManualPayment}><IconPlus size={16} /> Add a payment</Button><label className="button-primary upload-button"><IconFileUpload size={17} /> Import statement<input type="file" accept=".csv,text/csv" onChange={(event) => startImport(event.target.files?.[0])} /></label></div>} />{notice && <div className="inline-notice"><IconCheck size={16} />{notice}</div>}{mapping && <section className="panel mapping-panel"><div><span className="eyebrow">CHECK YOUR COLUMNS</span><h2>Match the statement fields</h2><p>We’ll use the date, description, and positive money-in amount.</p></div><div className="mapping-fields">{([["dateIndex", "Date"], ["amountIndex", "Amount or money in"], ["descIndex", "Description"]] as const).map(([key, label]) => <label key={key}>{label}<select className={textInput} value={mapping[key]} onChange={(event) => setMapping({ ...mapping, [key]: Number(event.target.value) })}>{mapping.headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header || `Column ${index + 1}`}</option>)}</select></label>)}</div><div className="mapping-preview">{mapping.rows.slice(0, 5).map((row, index) => <p key={index}>{row.slice(0, 6).join(" · ")}</p>)}</div><Button className="button-primary" onClick={() => void importMappedRows(mapping.fileName, mapping.rows, mapping).catch((error) => errorToast(error, "Could not import those columns."))}>Looks right</Button><button className="quiet-link" onClick={() => setMapping(null)}>Cancel</button></section>}<section className="panel payments-panel"><div className="payment-tabs">{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "matched" ? "Matched automatically" : item === "suggested" ? "Suggested" : "Needs you"} <span>{payments.filter((payment: any) => item === "unplaced" ? ["unplaced", "excluded"].includes(payment.status) : payment.status === item).length}</span></button>)}</div>{payments.length === 0 ? <div className="drop-empty"><div className="drop-icon"><IconFileUpload size={26} /></div><h2>Import a bank statement</h2><p>Upload a CSV with date, description, and amount columns. Only money-in rows are used.</p><button className="text-link" onClick={downloadSample}><IconDownload size={15} /> Download a sample statement</button></div> : filtered.length === 0 ? <div className="empty-work">No payments in this group yet.</div> : <div className="payment-list">{filtered.map((payment: any) => <article key={payment.id} className="payment-row"><div className="payment-date">{payment.transactionDate}</div><div className="payment-desc"><strong>{payment.description}</strong><small>{payment.matchReason}{payment.unitLabel ? ` · ${payment.unitLabel}` : ""}</small></div><strong className="payment-amount">{money(payment.amountCents)}</strong>{payment.status === "matched" ? <><span className="status-chip status-paid">✓ Matched automatically</span><button className="quiet-link" onClick={() => void undo.mutateAsync({ transactionId: payment.id })}>Undo</button></> : payment.status === "suggested" ? <><select className={textInput} value={candidateById[payment.id] ?? payment.unitId ?? ""} onChange={(event) => setCandidateById({ ...candidateById, [payment.id]: event.target.value })}><option value="">Choose unit</option>{units.map((unit: Unit) => <option key={unit.id} value={unit.id}>{unit.unitLabel} · {unit.tenantName}</option>)}</select><button className="button-secondary" disabled={!candidateById[payment.id] && !payment.unitId} onClick={() => void confirm.mutateAsync({ transactionId: payment.id, unitId: candidateById[payment.id] || payment.unitId || "", reason: payment.matchReason || "Confirmed by landlord" }).catch((error: unknown) => errorToast(error, "Could not confirm that match."))}>Confirm</button><button className="quiet-link" onClick={() => void exclude.mutateAsync({ transactionId: payment.id })}>Not this one</button></> : <><select className={textInput} value={candidateById[payment.id] ?? ""} onChange={(event) => setCandidateById({ ...candidateById, [payment.id]: event.target.value })}><option value="">Assign to unit</option>{units.map((unit: Unit) => <option key={unit.id} value={unit.id}>{unit.unitLabel} · {unit.tenantName}</option>)}</select><button className="button-secondary" disabled={!candidateById[payment.id]} onClick={() => void confirm.mutateAsync({ transactionId: payment.id, unitId: candidateById[payment.id] ?? "", reason: "Assigned by landlord" }).catch((error: unknown) => errorToast(error, "Could not match that payment."))}>Confirm</button><button className="quiet-link" onClick={() => void exclude.mutateAsync({ transactionId: payment.id })}>This isn’t rent</button></>}</article>)}</div>}</section><section className="import-history"><h2>Import history</h2>{imports.map((item: any) => <div key={item.id}><span><IconCalendar size={15} /> {item.bankName}</span><small>{new Date(item.importedAt).toLocaleDateString()} · {item.rowCount - item.skippedCount} imported · {item.skippedCount} skipped</small></div>)}</section><input id="sample-import" hidden type="file" accept=".csv" onChange={(event) => startImport(event.target.files?.[0])} />{activeImport && <span className="inline-notice">Importing statement…</span>}</>;
}

function MessagesScreen({ units, reminders, repairs, money }: any) {
  const [tab, setTab] = useState("Reminders");
  const [repairText, setRepairText] = useState("");
  const [repairNotice, setRepairNotice] = useState("");
  const [reminderFilter, setReminderFilter] = useState("To send");
  const [reminderText, setReminderText] = useState<Record<string, string>>({});
  const saveDraft = useActionMutation("save-reminder-draft");
  const updateStatus = useActionMutation("update-reminder-status");
  const repairStatus = useActionMutation("update-repair-status");
  const copyMessage = async (message: string) => { await navigator.clipboard.writeText(message); toast.success("Message copied."); };
  const reminderRows = reminders.filter((reminder: any) => reminderFilter === "Sent" ? reminder.status === "sent" : reminder.status !== "sent" && reminder.status !== "skipped");
  const setReminderStatus = async (reminder: any, status: "sent" | "skipped", message: string) => {
    try {
      const saved = await saveDraft.mutateAsync({ unitId: reminder.unitId, stage: reminder.stage, amountCents: reminder.amountCents, daysLate: reminder.daysLate, message });
      await updateStatus.mutateAsync({ id: saved.id, status });
    } catch (error) { errorToast(error, "Could not update this reminder."); }
  };
  const draftRepair = () => {
    if (!repairText.trim()) return;
    sendToAgentChat({ chatTarget: "local", message: `Classify this tenant repair message, choose an urgency of Urgent, Soon, or Routine, draft a calm suggested reply, and save it with save-repair-request. Do not promise a repair time. Message: ${repairText.trim()}`, context: JSON.stringify({ view: "messages", tab: "repairs" }), submit: true, openSidebar: true });
    setRepairNotice("The assistant is reviewing this message. Its saved request will appear here.");
  };
  return <><PageHeader title="Messages" description="Draft the right words. You decide when they go." /><div className="page-tabs">{["Reminders", "Renewals", "Repairs"].map((item) => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>{tab === "Reminders" && <div className="reminder-filter">{["To send", "Sent"].map((item) => <button key={item} className={reminderFilter === item ? "selected" : ""} onClick={() => setReminderFilter(item)}>{item}</button>)}</div>}{tab === "Reminders" && <div className="message-grid">{reminderRows.map((reminder: any) => <article key={reminder.unitId} className="panel message-card"><div className="message-card-top"><span className={`stage-chip stage-${reminder.stage.toLowerCase()}`}>{reminder.stage}</span><span className="message-meta">{reminder.daysLate} days late</span></div><h2>{reminder.tenantName} <small>· {reminder.unitLabel}</small></h2><strong className="message-balance">{money(reminder.amountCents)} still owed</strong><textarea className="message-text" value={reminderText[reminder.unitId] ?? reminder.message} onChange={(event) => setReminderText((current) => ({ ...current, [reminder.unitId]: event.target.value }))} onBlur={(event) => void saveDraft.mutateAsync({ unitId: reminder.unitId, stage: reminder.stage, amountCents: reminder.amountCents, daysLate: reminder.daysLate, message: event.currentTarget.value }).catch((error) => errorToast(error, "Could not save this draft."))} /><p className="legal-note">Add any wording required where you live. Rent Roll does not send this message.</p><div className="message-actions"><Button className="button-primary" onClick={() => void copyMessage(reminderText[reminder.unitId] ?? reminder.message)}><IconCopy size={15} /> Copy message</Button>{reminder.tenantEmail && <a className="button-secondary" href={`mailto:${encodeURIComponent(reminder.tenantEmail)}?body=${encodeURIComponent(reminderText[reminder.unitId] ?? reminder.message)}`}>Open in email</a>}<button className="quiet-link" onClick={() => void setReminderStatus(reminder, "sent", reminderText[reminder.unitId] ?? reminder.message)}>Mark as sent</button><button className="quiet-link" onClick={() => void setReminderStatus(reminder, "skipped", reminderText[reminder.unitId] ?? reminder.message)}>Skip</button></div></article>)}{reminderRows.length === 0 && <div className="empty-work">No reminders in this group.</div>}</div>}{tab === "Renewals" && <div className="message-grid">{units.filter((unit: Unit) => unit.leaseEnd <= "2026-12-17").map((unit: Unit) => <article key={unit.id} className="panel message-card"><div className="message-card-top"><span className="stage-chip">Upcoming</span><span className="message-meta">Ends {unit.leaseEnd}</span></div><h2>{unit.tenantName} <small>· {unit.unitLabel}</small></h2><p>Current rent <strong>{money(unit.rentCents)}</strong></p><textarea className="message-text" defaultValue={`Hi ${unit.tenantName}, your lease for ${unit.unitLabel} is coming to an end on ${unit.leaseEnd}. Please let me know if you would like to discuss renewal options.`} /><p className="legal-note">Review any local requirements before sending.</p><Button className="button-primary" onClick={(event) => { const text = event.currentTarget.closest("article")?.querySelector("textarea")?.value ?? ""; void copyMessage(text); }}><IconCopy size={15} /> Copy message</Button></article>)}</div>}{tab === "Repairs" && <section className="panel repair-panel"><label htmlFor="repair-message">Paste a message from a tenant</label><textarea id="repair-message" className="repair-input" placeholder="Paste the tenant’s message here…" value={repairText} onChange={(event) => setRepairText(event.target.value)} /><Button className="button-primary" onClick={draftRepair} disabled={!repairText.trim()}><IconMessageCircle size={16} /> Ask assistant to review</Button>{repairNotice && <p className="inline-notice">{repairNotice}</p>}<div className="repair-list">{repairs.map((repair: any) => <article key={repair.id}><div><strong>{repair.category}</strong><p>{repair.tenantMessage}</p><small>{repair.urgency} · {repair.suggestedReply}</small></div><select value={repair.status} onChange={(event) => void repairStatus.mutateAsync({ id: repair.id, status: event.target.value as "New" | "Scheduled" | "Done" })}><option>New</option><option>Scheduled</option><option>Done</option></select></article>)}</div></section>}</>;
}

function PropertiesScreen({ units, leaseHistory, loading, money, onAdd }: any) {
  const properties: string[] = useMemo(() => Array.from(new Set<string>((units as Unit[]).map((unit) => unit.property))), [units]);
  return <><PageHeader title="Properties" description="A clear view of your homes and tenants." action={<Button className="button-primary" onClick={onAdd}><IconPlus size={16} /> Add a unit</Button>} />{loading ? <div className="empty-work">Loading properties…</div> : properties.map((property) => <section className="panel property-panel" key={property}><div className="panel-heading"><div><span className="eyebrow">PROPERTY</span><h2>{property}</h2></div><span className="property-count">{units.filter((unit: Unit) => unit.property === property).length} units</span></div><div className="property-table">{units.filter((unit: Unit) => unit.property === property).map((unit: Unit) => <PropertyUnitRow key={unit.id} unit={unit} money={money} />)}</div><details className="lease-history"><summary>Past lease details</summary>{leaseHistory.filter((entry: any) => units.some((unit: Unit) => unit.id === entry.unitId && unit.property === property)).map((entry: any) => <div key={entry.id}><strong>{entry.unitLabel ?? units.find((unit: Unit) => unit.id === entry.unitId)?.unitLabel}</strong><span>{entry.tenantName}</span><span>{money(entry.rentCents)} monthly</span><span>Ended {entry.leaseEnd}</span></div>)}</details></section>)}{properties.length === 0 && <div className="empty-work">Add your first unit to create a property.</div>}</>;
}

function PropertyUnitRow({ unit, money }: { unit: Unit; money: (cents: number) => string }) {
  const update = useActionMutation("update-rent-unit");
  const [rent, setRent] = useState(formatCents(unit.rentCents, "", true));
  const saveRent = () => void update.mutateAsync({ id: unit.id, rentCents: parseMoneyCents(rent) }).catch((error) => errorToast(error, "Could not update the rent."));
  return <div className="property-unit-row"><input className={textInput} aria-label="Unit label" defaultValue={unit.unitLabel} onBlur={(event) => void update.mutateAsync({ id: unit.id, unitLabel: event.currentTarget.value }).catch((error) => errorToast(error, "Could not update the unit label."))} /><input className={textInput} aria-label={`${unit.unitLabel} tenant`} defaultValue={unit.tenantName} onBlur={(event) => void update.mutateAsync({ id: unit.id, tenantName: event.currentTarget.value }).catch((error) => errorToast(error, "Could not update the tenant."))} /><input className={textInput} aria-label={`${unit.unitLabel} monthly rent`} value={rent} onChange={(event) => setRent(event.target.value)} onBlur={saveRent} /><input className={textInput} aria-label={`${unit.unitLabel} due date`} type="date" defaultValue={unit.dueDate} onBlur={(event) => void update.mutateAsync({ id: unit.id, dueDate: event.currentTarget.value }).catch((error) => errorToast(error, "Could not update the due date."))} /><input className={textInput} aria-label={`${unit.unitLabel} lease end`} type="date" defaultValue={unit.leaseEnd} onBlur={(event) => void update.mutateAsync({ id: unit.id, leaseEnd: event.currentTarget.value }).catch((error) => errorToast(error, "Could not update the lease end."))} /><span>{money(unit.paidCents)} paid</span></div>;
}

type SettingsPatch = Partial<Pick<Settings, "landlordName" | "currencySymbol" | "dateFormat" | "timezone" | "weekStart" | "autoMatch" | "friendlyDays" | "firmDays" | "formalDays" | "friendlyTemplate" | "firmTemplate" | "formalTemplate" | "scheduleEnabled">>;

function SettingsScreen({ settings, units, money }: { settings?: Settings; units: Unit[]; money: (cents: number) => string }) {
  const update = useActionMutation("update-rent-settings");
  const [form, setForm] = useState<SettingsPatch>({});
  const value = { ...settings, ...form } as Settings;
  const save = async (patch: SettingsPatch) => {
    try { await update.mutateAsync(patch); setForm((current) => ({ ...current, ...patch })); toast.success("Settings saved."); }
    catch (error) { errorToast(error, "Could not save settings."); }
  };
  const updateField = <K extends keyof SettingsPatch>(key: K, next: NonNullable<SettingsPatch[K]>) => setForm((current) => ({ ...current, [key]: next }));
  return <><PageHeader title="Settings" description="Make Rent Roll work the way you do." /><div className="settings-stack"><section className="panel settings-card"><div className="settings-head"><h2>Reminders</h2><p>Neutral starting templates. Review local requirements before sending.</p></div>{(["friendly", "firm", "formal"] as const).map((stage) => <div className="setting-template" key={stage}><label>{stage.charAt(0).toUpperCase() + stage.slice(1)} · days after due</label><input className={textInput} type="number" min={1} max={90} value={value[`${stage}Days`] ?? (stage === "friendly" ? 3 : stage === "firm" ? 7 : 14)} onChange={(event) => updateField(`${stage}Days`, Number(event.target.value))} onBlur={() => void save({ [`${stage}Days`]: value[`${stage}Days`] ?? (stage === "friendly" ? 3 : stage === "firm" ? 7 : 14) } as SettingsPatch)} /><textarea className="message-text" value={value[`${stage}Template`] ?? ""} onChange={(event) => updateField(`${stage}Template`, event.target.value)} onBlur={() => void save({ [`${stage}Template`]: value[`${stage}Template`] } as SettingsPatch)} /></div>)}</section><section className="panel settings-card"><div className="settings-head"><h2>Matching</h2><p>Ask tenants to put their unit label in the payment reference.</p></div><label className="switch-row"><span>Confirm exact unit references and amounts automatically</span><input type="checkbox" checked={value.autoMatch ?? true} onChange={(event) => void save({ autoMatch: event.target.checked })} /></label></section><section className="panel settings-card"><div className="settings-head"><h2>Your details</h2></div><div className="settings-grid"><label>Name<input className={textInput} value={value.landlordName ?? ""} onChange={(event) => updateField("landlordName", event.target.value)} onBlur={() => void save({ landlordName: value.landlordName })} /></label><label>Currency symbol<input className={textInput} maxLength={4} value={value.currencySymbol ?? "$"} onChange={(event) => updateField("currencySymbol", event.target.value)} onBlur={() => void save({ currencySymbol: value.currencySymbol })} /></label><label>Date format<select className={textInput} value={value.dateFormat ?? "MMM d, yyyy"} onChange={(event) => void save({ dateFormat: event.target.value })}><option>MMM d, yyyy</option><option>MM/dd/yyyy</option><option>dd/MM/yyyy</option></select></label><label>Timezone<input className={textInput} value={value.timezone ?? "America/Los_Angeles"} onChange={(event) => updateField("timezone", event.target.value)} onBlur={() => void save({ timezone: value.timezone })} /></label><label>Week starts<select className={textInput} value={value.weekStart ?? "Monday"} onChange={(event) => void save({ weekStart: event.target.value as "Monday" | "Sunday" })}><option>Monday</option><option>Sunday</option></select></label></div></section><section className="panel settings-card"><div className="settings-head"><h2>The assistant</h2><p>Connect an AI model to ask questions and set up your rent roll with the assistant. The assistant does not send messages or move money.</p></div><div className="schedule-row"><span>AI provider and model</span><a className="quiet-link" href="/settings/model">Set up AI model →</a></div><div className="schedule-row"><span>Monday routine · 6:00 AM</span><a className="quiet-link" href="/settings/automations">Manage schedule</a></div></section><section className="panel settings-card"><div className="settings-head"><h2>Data</h2><p>Export a copy of your current rent roll.</p></div><Button className="button-secondary" onClick={() => exportRentRoll(units, money)}><IconDownload size={16} /> Export rent roll as CSV</Button></section></div></>;
}

function exportRentRoll(units: Unit[], money: (cents: number) => string) {
  const rows = [["Property", "Unit", "Tenant", "Monthly rent", "Paid", "Still owed", "Due date", "Lease end"], ...units.map((unit) => [unit.property, unit.unitLabel, unit.tenantName, money(unit.rentCents), money(unit.paidCents), money(unit.rentCents - unit.paidCents), unit.dueDate, unit.leaseEnd])];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "rent-roll.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function AddUnitSheet({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const create = useActionMutation("create-rent-unit");
  const [form, setForm] = useState({ property: "", unitLabel: "", tenantName: "", tenantEmail: "", rentDollars: "", dueDate: "", leaseEnd: "", vacant: false });
  const save = async () => {
    try {
      await create.mutateAsync({ property: form.property, unitLabel: form.unitLabel, tenantName: form.vacant ? "" : form.tenantName, tenantEmail: form.vacant ? "" : form.tenantEmail, rentCents: parseMoneyCents(form.rentDollars), dueDate: form.dueDate, leaseEnd: form.vacant ? "" : form.leaseEnd });
      toast.success("Unit added to your rent roll.");
      onSaved();
      setForm({ property: "", unitLabel: "", tenantName: "", tenantEmail: "", rentDollars: "", dueDate: "", leaseEnd: "", vacant: false });
    } catch (error) { errorToast(error, "Check the unit details and try again."); }
  };
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="rent-sheet"><SheetHeader><SheetTitle>Add a unit</SheetTitle><SheetDescription>Enter the unit, tenant, and lease details.</SheetDescription></SheetHeader><div className="sheet-form"><label>Property<input className={textInput} value={form.property} onChange={(event) => setForm({ ...form, property: event.target.value })} /></label><label>Unit label<input className={textInput} value={form.unitLabel} onChange={(event) => setForm({ ...form, unitLabel: event.target.value })} /></label><label className="vacant-check"><input type="checkbox" checked={form.vacant} onChange={(event) => setForm({ ...form, vacant: event.target.checked, tenantName: "", tenantEmail: "", leaseEnd: "" })} /> Vacant unit</label><label>Tenant name<input className={textInput} disabled={form.vacant} value={form.tenantName} onChange={(event) => setForm({ ...form, tenantName: event.target.value })} /></label><label>Tenant email<input className={textInput} disabled={form.vacant} type="email" value={form.tenantEmail} onChange={(event) => setForm({ ...form, tenantEmail: event.target.value })} /></label><label>Monthly rent<input className={textInput} inputMode="decimal" placeholder="1,850.00" value={form.rentDollars} onChange={(event) => setForm({ ...form, rentDollars: event.target.value })} /></label><label>Due date<input className={textInput} type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>{!form.vacant && <label>Lease end<input className={textInput} type="date" value={form.leaseEnd} onChange={(event) => setForm({ ...form, leaseEnd: event.target.value })} /></label>}<Button className="button-primary" disabled={create.isPending} onClick={save}><IconPlus size={16} /> Add unit</Button></div></SheetContent></Sheet>;
}

function AddPaymentSheet({ open, units, onOpenChange, onSaved }: { open: boolean; units: Unit[]; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const savePayment = useActionMutation("record-manual-payment");
  const [form, setForm] = useState({ unitId: "", date: new Date().toISOString().slice(0, 10), amount: "", reference: "Manual payment" });
  const save = async () => {
    try {
      await savePayment.mutateAsync({ unitId: form.unitId, transactionDate: form.date, amountCents: parseMoneyCents(form.amount), description: form.reference });
      toast.success("Payment recorded with an undo entry.");
      onSaved();
      setForm({ unitId: "", date: new Date().toISOString().slice(0, 10), amount: "", reference: "Manual payment" });
    } catch (error) { errorToast(error, "Check the payment details and try again."); }
  };
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="rent-sheet"><SheetHeader><SheetTitle>Add a payment</SheetTitle><SheetDescription>Record a payment already received. Rent Roll will not move money.</SheetDescription></SheetHeader><div className="sheet-form"><label>Unit<select className={textInput} value={form.unitId} onChange={(event) => setForm({ ...form, unitId: event.target.value })}><option value="">Choose a unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitLabel} · {unit.tenantName}</option>)}</select></label><label>Payment date<input className={textInput} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>Amount<input className={textInput} inputMode="decimal" placeholder="1,850.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Reference<input className={textInput} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></label><Button className="button-primary" disabled={savePayment.isPending || !form.unitId} onClick={save}><IconPlus size={16} /> Record payment</Button></div></SheetContent></Sheet>;
}

function UnitDetailSheet({ unit, payments, onOpenChange, money, onMatch, onUndo }: { unit: Unit | null; payments: any[]; onOpenChange: (open: boolean) => void; money: (cents: number) => string; onMatch: () => void; onUndo: (id: string) => void }) {
  const update = useActionMutation("update-rent-unit");
  return <Sheet open={Boolean(unit)} onOpenChange={onOpenChange}><SheetContent side="right" className="rent-sheet"><SheetHeader><SheetTitle>{unit?.tenantName} · {unit?.unitLabel}</SheetTitle><SheetDescription>{unit?.property}</SheetDescription></SheetHeader>{unit && <div className="unit-detail"><div><span>Due date</span><strong>{unit.dueDate}</strong></div><div><span>Rent due</span><strong>{money(unit.rentCents)}</strong></div><div><span>Amount paid</span><strong>{money(unit.paidCents)}</strong></div><div><span>Still owed</span><strong>{money(Math.max(0, unit.rentCents - unit.paidCents))}</strong></div><div><span>Lease ends</span><strong>{unit.leaseEnd}</strong></div><label className="unit-note">Note<textarea className="message-text" defaultValue={unit.notes} onBlur={(event) => void update.mutateAsync({ id: unit.id, notes: event.currentTarget.value }).catch((error) => errorToast(error, "Could not save this note."))} /></label><h3>Matched payments</h3>{payments.map((payment) => <div className="unit-payment" key={payment.id}><span>{payment.transactionDate} · {money(payment.amountCents)}</span><small>{payment.matchReason}</small><button className="quiet-link" onClick={() => onUndo(payment.id)}>Undo</button></div>)}<Button className="button-secondary" onClick={onMatch}><IconCreditCard size={16} /> Match a payment</Button><Button className="button-secondary" onClick={() => sendToAgentChat({ chatTarget: "local", message: `Draft a neutral rent reminder for ${unit.tenantName} at ${unit.unitLabel}. Read the current rent data and use the saved template. Do not send it; save the draft with save-reminder-draft.`, context: JSON.stringify({ selectedUnitId: unit.id, unitLabel: unit.unitLabel }), submit: true, openSidebar: true })}><IconMessageCircle size={16} /> Draft a reminder</Button></div>}</SheetContent></Sheet>;
}
