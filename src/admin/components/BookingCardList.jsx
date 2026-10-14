// components/BookingCardList.jsx
//
// Full custom "list" page for the Booking resource. Mirrors the Staff
// design language (StaffCardList): a vertically stacked list of cards,
// each with a main clickable area on the left (customer, service,
// contact details) and a right-side panel (appointment slot, assigned
// staff, quick actions) — using the same useIsMobile + style-as-function
// pattern StaffCardList uses to stack the panel below the main content
// on narrow screens.
//
// Filtering: four dropdowns (Status, Service/Package, Staff, Date) plus a
// single Clear filter button, instead of a row of status pills. Staff can
// still be preset via ?staffId=<id> (set by the "Today's Schedule" panel
// on a Staff card) — that just seeds the Staff dropdown's initial value.
//
// Completed bookings are read-only: once a booking's status is
// "completed", Cancel / Delete / Reassign / Reschedule are hidden and the
// card just shows a "Completed — no changes possible" note instead. This
// is enforced server-side too (setupAdmin.js's assertBookingEditable), so
// this is a UI convenience, not the actual security boundary.
//
// staffId / serviceId are read directly off booking.params, same as
// StaffCardList does when it matches today's bookings to a staff member
// (`p.staffId`, `b.serviceId`) — no flattening or dot-notation handling
// needed, since setupAdmin.js's attachBookingIds "after" hook guarantees
// these scalar FK columns are present on every Booking record returned.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const MOBILE_BREAKPOINT = 768;

// Tracks whether we're under the mobile breakpoint. Used to swap each
// card from a two-column (main + right side panel) layout to a stacked
// one — same hook as StaffCardList.
function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return isMobile;
}

const STATUS_STYLE = {
  confirmed: { bg: "#e0e7ff", color: "#4338ca" },
  staff_assigned: { bg: "#dbeafe", color: "#1d4ed8" },
  rescheduled: { bg: "#fff4e0", color: "#a6650a" },
  completed: { bg: "#e6f6ec", color: "#1d8a4c" },
  cancelled: { bg: "#fdecec", color: "#c0392b" },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "staff_assigned", label: "Staff assigned" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function getStaffIdFilterFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("staffId") || "";
}

// Preset the Service/Package dropdown the same way staffId presets the
// Staff dropdown — set by ServiceCardList's "Staff offering this" panel
// (?serviceId=) and PackageCardList's "Bookings" panel (?packageId=).
function getServiceOrPackageFilterFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const serviceId = params.get("serviceId");
  if (serviceId) return `svc:${serviceId}`;
  const packageId = params.get("packageId");
  if (packageId) return `pkg:${packageId}`;
  return "all";
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function statusLabel(status) {
  return (status || "unknown").replace(/_/g, " ");
}

function initialsOf(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const styles = {
  page: { maxWidth: 850, width: "100%", boxSizing: "border-box", margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    paddingBottom: 16,
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: 700, margin: 0, color: "#1a1d24" },
  subtitle: { fontSize: 13, color: "#8892a6", marginTop: 4 },

  filterRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  filterField: { display: "flex", flexDirection: "column", gap: 4 },
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#8892a6",
  },
  filterSelect: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1a1d24",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #dfe2ea",
    background: "#fff",
    cursor: "pointer",
    minWidth: 160,
  },
  filterDate: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1a1d24",
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid #dfe2ea",
    background: "#fff",
    cursor: "pointer",
  },
  clearFilter: {
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #dfe2ea",
    background: "#fff",
    color: "#4b5061",
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  },

  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: (isMobile) => ({
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: "stretch",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fff",
    transition: "box-shadow 0.15s, border-color 0.15s",
    overflow: "hidden",
  }),
  mainClickable: (isMobile) => ({
    display: "flex",
    alignItems: "flex-start",
    gap: isMobile ? 14 : 20,
    padding: isMobile ? 14 : 18,
    flex: 1,
    minWidth: 0,
    cursor: "pointer",
    color: "inherit",
    textDecoration: "none",
  }),
  avatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "#eef1f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 600,
    color: "#8892a6",
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0 },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  name: { fontSize: 16, fontWeight: 700, color: "#1a1d24" },
  appId: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: 700,
    color: "#4f46e5",
  },
  statusBadge: (status) => {
    const s = STATUS_STYLE[status] || { bg: "#f0f1f4", color: "#8892a6" };
    return {
      display: "inline-block",
      padding: "2px 9px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      textTransform: "capitalize",
      background: s.bg,
      color: s.color,
    };
  },
  service: { fontSize: 13, color: "#8892a6" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#b0b6c3",
    marginBottom: 6,
    marginTop: 10,
  },
  chip: {
    display: "inline-block",
    background: "#eef1f7",
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    marginRight: 6,
    marginBottom: 4,
    color: "#1a1d24",
  },
  verified: {
    display: "inline-block",
    background: "#e6f6ec",
    color: "#1d8a4c",
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  empty: { color: "#b0b6c3", fontSize: 13, fontStyle: "italic" },
  loading: { color: "#8892a6", padding: 24, textAlign: "center" },
  error: {
    fontSize: 13,
    color: "#b91c1c",
    background: "#fef2f2",
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
  },

  // --- Appointment side panel ---
  panel: (isMobile) => ({
    width: isMobile ? "auto" : 260,
    flexShrink: 0,
    borderLeft: isMobile ? "none" : "1px solid #eceef2",
    borderTop: isMobile ? "1px solid #eceef2" : "none",
    background: "#fafbfc",
    padding: isMobile ? "12px 14px 14px" : 16,
    display: "flex",
    flexDirection: "column",
  }),
  panelHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  panelActions: { display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" },
  panelHeader: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#8892a6",
    marginBottom: 8,
    marginTop: 14,
  },
  clickableField: {
    cursor: "pointer",
    padding: "6px 8px",
    margin: "-6px -8px",
    borderRadius: 8,
    transition: "background 0.15s ease",
  },
  staticField: { padding: "6px 8px", margin: "-6px -8px" },
  fieldHint: {
    fontSize: 12,
    fontWeight: 400,
    color: "#8892a6",
    marginBottom: 4,
  },
  panelDate: { fontSize: 13, fontWeight: 700, color: "#1a1d24" },
  panelTime: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  staffLink: {
    fontSize: 13,
    color: "#4f46e5",
    fontWeight: 600,
  },
  staffNone: { fontSize: 13, color: "#b0b6c3", fontStyle: "italic" },
  topBtn: {
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #f6d5d5",
    background: "#fff",
    color: "#c0392b",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  topBtnGhost: {
    fontSize: 11,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid transparent",
    background: "transparent",
    color: "#b0b6c3",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  inlinePanel: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    padding: "6px 8px",
    border: "1px solid #dfe2ea",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    background: "#fff",
  },
  btnPrimary: {
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: 6,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    cursor: "pointer",
    flexShrink: 0,
  },
  completedNote: {
    fontSize: 12,
    color: "#1d8a4c",
    background: "#e6f6ec",
    padding: "8px 10px",
    borderRadius: 8,
    marginTop: 14,
  },
};

function BookingCard({ booking, staffOptions, serviceOptions, onChanged, isMobile }) {
  const p = booking.params || {};
  const isCompleted = p.status === "completed";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState(null); // null | 'reassign' | 'reschedule'
  const [staffId, setStaffId] = useState("");
  const [newTime, setNewTime] = useState("");

  // Direct property access — same as StaffCardList's own booking lookup
  // (`p.staffId`, `b.serviceId`). setupAdmin.js's attachBookingIds "after"
  // hook guarantees these are present on every Booking record.
  const staffName = staffOptions.find((s) => s.id === p.staffId)?.name;
  const serviceName = serviceOptions.find((s) => s.id === p.serviceId)?.name;

  async function runAction(actionName, data) {
    setError("");
    setBusy(true);
    try {
      const res = await api.recordAction({
        resourceId: "Booking",
        recordId: booking.id,
        actionName,
        data,
      });
      setPanel(null);
      // reassignStaff / reschedule / cancelBooking already do their own
      // resource.findOne() server-side and hand back the fresh record —
      // patch it straight into the list instead of re-fetching the whole
      // list, which can come back browser-cached and mask a write that
      // actually succeeded. delete's handler returns the pre-write
      // record (no deletedAt), so force a full reload for that one.
      onChanged(actionName === "delete" ? undefined : res?.data?.record);
    } catch (err) {
      setError(
        err?.response?.data?.errors?.[0]?.message ||
          err.message ||
          "That action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleCancel(e) {
    e.stopPropagation();
    if (window.confirm("Cancel this booking? The customer will be notified."))
      runAction("cancelBooking", {});
  }

  function handleDelete(e) {
    e.stopPropagation();
    if (window.confirm("Hide this booking? The customer is not notified.")) runAction("delete", {});
  }

  function stop(e) {
    e.stopPropagation();
  }

  return (
    <div
      style={styles.card(isMobile)}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
        e.currentTarget.style.borderColor = "#c9cedb";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "#e5e7eb";
      }}
    >
      <div
        style={styles.mainClickable(isMobile)}
        onClick={() => {
          window.location.href = `/backoffice/resources/Booking/records/${booking.id}/show`;
        }}
      >
        <div style={styles.avatar}>{initialsOf(p.customerName)}</div>

        <div style={styles.body}>
          <div style={styles.topRow}>
            <span style={styles.name}>{p.customerName || "No name"}</span>
            <span style={styles.statusBadge(p.status)}>{statusLabel(p.status)}</span>
            <span style={styles.appId}>{p.applicationId}</span>
          </div>

          <div style={styles.service}>
            {serviceName || (p.serviceId ? `Unknown service (${p.serviceId})` : "No service")}
          </div>

          <div style={styles.sectionLabel}>Contact</div>
          <div>
            {p.customerPhone && <span style={styles.chip}>{p.customerPhone}</span>}
            {p.customerEmail && <span style={styles.chip}>{p.customerEmail}</span>}
            {!p.customerPhone && !p.customerEmail && (
              <span style={styles.empty}>No contact details</span>
            )}
            {p.phoneVerified && <span style={styles.verified}>Phone verified</span>}
            {p.emailVerified && <span style={styles.verified}>Email verified</span>}
          </div>

          {error && <div style={{ ...styles.error, marginTop: 10, marginBottom: 0 }}>{error}</div>}
        </div>
      </div>

      <div style={styles.panel(isMobile)} onClick={stop}>
        <div style={styles.panelHeaderRow}>
          <div style={{ ...styles.panelHeader, marginTop: 0 }}>Appointment</div>
          {!isCompleted && (
            <div style={styles.panelActions}>
              <button type="button" style={styles.topBtn} disabled={busy} onClick={handleCancel}>
                Cancel
              </button>
              <button
                type="button"
                style={styles.topBtnGhost}
                disabled={busy}
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {isCompleted ? (
          <div style={styles.staticField}>
            <div style={styles.fieldHint}>Starts</div>
            <div style={styles.panelDate}>{formatDate(p.startTime)}</div>
            <div style={styles.panelTime}>
              {formatTime(p.startTime)}
              {p.endTime ? ` – ${formatTime(p.endTime)}` : ""}
            </div>
          </div>
        ) : (
          <div
            style={styles.clickableField}
            onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#eef1f7")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Click to reschedule"
          >
            <div style={styles.fieldHint}>Starts (click to change)</div>
            <div style={styles.panelDate}>{formatDate(p.startTime)}</div>
            <div style={styles.panelTime}>
              {formatTime(p.startTime)}
              {p.endTime ? ` – ${formatTime(p.endTime)}` : ""}
            </div>
          </div>
        )}

        {!isCompleted && panel === "reschedule" && (
          <div style={styles.inlinePanel}>
            <input
              type="datetime-local"
              style={styles.input}
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
            <button
              type="button"
              style={styles.btnPrimary}
              disabled={!newTime || busy}
              onClick={() =>
                runAction("reschedule", {
                  startTime: new Date(newTime).toISOString(),
                })
              }
            >
              Save
            </button>
          </div>
        )}

        {isCompleted ? (
          <div style={{ ...styles.staticField, marginTop: 14 }}>
            <div style={styles.fieldHint}>Staff</div>
            {staffName ? (
              <span style={styles.staffLink}>{staffName}</span>
            ) : p.staffId ? (
              <span style={styles.staffNone}>{`Unknown staff (${p.staffId})`}</span>
            ) : (
              <span style={styles.staffNone}>Not assigned</span>
            )}
          </div>
        ) : (
          <div
            style={{ ...styles.clickableField, marginTop: 14 }}
            onClick={() => setPanel(panel === "reassign" ? null : "reassign")}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#eef1f7")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title="Click to reassign"
          >
            <div style={styles.fieldHint}>Staff (click to change)</div>
            {staffName ? (
              <span style={styles.staffLink}>{staffName}</span>
            ) : p.staffId ? (
              <span style={styles.staffNone}>{`Unknown staff (${p.staffId})`}</span>
            ) : (
              <span style={styles.staffNone}>Not assigned</span>
            )}
          </div>
        )}

        {!isCompleted && panel === "reassign" && (
          <div style={styles.inlinePanel}>
            <select
              style={styles.input}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              <option value="">Choose staff…</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={styles.btnPrimary}
              disabled={!staffId || busy}
              onClick={() => runAction("reassignStaff", { staffId })}
            >
              Save
            </button>
          </div>
        )}

        {isCompleted && <div style={styles.completedNote}>Completed — no changes possible.</div>}
      </div>
    </div>
  );
}

const BookingCardList = () => {
  const [bookings, setBookings] = useState(null);
  const [staffOptions, setStaffOptions] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [packageOptions, setPackageOptions] = useState([]);
  const [error, setError] = useState("");

  // --- Filters ---
  const [statusFilter, setStatusFilter] = useState("all");
  // "all" | "svc:<id>" | "pkg:<id>"
  const [serviceFilter, setServiceFilter] = useState(getServiceOrPackageFilterFromUrl());
  const [staffFilterId, setStaffFilterId] = useState(getStaffIdFilterFromUrl());
  const [dateFilter, setDateFilter] = useState(""); // yyyy-mm-dd, "" = all dates

  const isMobile = useIsMobile();

  async function load() {
    setError("");
    try {
      const [bookingRes, staffRes, serviceRes, packageRes] = await Promise.all([
        api.resourceAction({
          resourceId: "Booking",
          actionName: "list",
          params: { perPage: 500 },
        }),
        api.resourceAction({
          resourceId: "Staff",
          actionName: "list",
          params: { perPage: 200 },
        }),
        api.resourceAction({
          resourceId: "Service",
          actionName: "list",
          params: { perPage: 500 },
        }),
        api
          .resourceAction({
            resourceId: "Package",
            actionName: "list",
            params: { perPage: 500 },
          })
          .catch(() => ({ data: { records: [] } })),
      ]);
      setBookings(bookingRes?.data?.records || []);
      setStaffOptions(
        (staffRes?.data?.records || []).map((r) => ({
          id: r.id ?? r.params?.id,
          name: r.params?.name,
        })),
      );
      setServiceOptions(
        (serviceRes?.data?.records || []).map((r) => ({
          id: r.id ?? r.params?.id,
          name: r.params?.name,
        })),
      );
      setPackageOptions(
        (packageRes?.data?.records || []).map((r) => ({
          id: r.id ?? r.params?.id,
          name: r.params?.title,
        })),
      );
    } catch (err) {
      setBookings([]);
      setError(err.message || "Bookings could not be loaded. Refresh to retry.");
    }
  }

  useEffect(() => {
    load();
    setStaffFilterId(getStaffIdFilterFromUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBookingChanged(updatedRecord) {
    if (!updatedRecord) {
      // delete's handler doesn't reload after writing deletedAt, so no
      // record comes back — fall back to a full reload for that case.
      load();
      return;
    }
    setBookings((prev) => prev.map((b) => (b.id === updatedRecord.id ? updatedRecord : b)));
  }

  function clearFilters() {
    setStatusFilter("all");
    setServiceFilter("all");
    setStaffFilterId("");
    setDateFilter("");
    // Drop ?staffId= from the URL without a full navigation, so a later
    // refresh doesn't silently reintroduce a filter that was just cleared.
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  if (!bookings) return <div style={styles.loading}>Loading bookings…</div>;

  const live = bookings.filter((b) => !b.params?.deletedAt);

  const visible = live
    .filter((b) => (statusFilter === "all" ? true : b.params?.status === statusFilter))
    .filter((b) => {
      if (serviceFilter === "all") return true;
      const [type, id] = serviceFilter.split(":");
      if (type === "svc") return b.params?.serviceId === id;
      if (type === "pkg") return b.params?.packageId === id;
      return true;
    })
    .filter((b) => (staffFilterId ? b.params?.staffId === staffFilterId : true))
    .filter((b) => (dateFilter ? toDateInputValue(b.params?.startTime) === dateFilter : true))
    .sort((a, b) => new Date(b.params?.startTime) - new Date(a.params?.startTime));

  const filteredStaffName = staffFilterId
    ? staffOptions.find((s) => s.id === staffFilterId)?.name || "this staff member"
    : null;

  const hasActiveFilter =
    statusFilter !== "all" || serviceFilter !== "all" || !!staffFilterId || !!dateFilter;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Bookings</h1>
          <div style={styles.subtitle}>
            {staffFilterId
              ? `Showing bookings for ${filteredStaffName}`
              : `${live.length} booking${live.length === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.filterRow}>
        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Status</label>
          <select
            style={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Service / Package</label>
          <select
            style={styles.filterSelect}
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="all">All</option>
            {serviceOptions.length > 0 && (
              <optgroup label="Services">
                {serviceOptions.map((s) => (
                  <option key={`svc:${s.id}`} value={`svc:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
            {packageOptions.length > 0 && (
              <optgroup label="Packages">
                {packageOptions.map((p) => (
                  <option key={`pkg:${p.id}`} value={`pkg:${p.id}`}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Staff</label>
          <select
            style={styles.filterSelect}
            value={staffFilterId}
            onChange={(e) => setStaffFilterId(e.target.value)}
          >
            <option value="">All</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Date</label>
          <input
            type="date"
            style={styles.filterDate}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        {hasActiveFilter && (
          <button type="button" style={styles.clearFilter} onClick={clearFilters}>
            Clear filter
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div style={styles.loading}>
          {hasActiveFilter ? "No bookings match these filters." : "No bookings yet."}
        </div>
      ) : (
        <div style={styles.list}>
          {visible.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              staffOptions={staffOptions}
              serviceOptions={serviceOptions}
              onChanged={handleBookingChanged}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingCardList;
