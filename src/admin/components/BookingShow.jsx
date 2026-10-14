// components/BookingShow.jsx
//
// Full custom "show" page for the Booking resource. Same profile-style
// layout as StaffShow: avatar + name + status at the top, key info in a
// clean grid, sections for the appointment, the customer, and the change
// history.
//
// Button placement:
// - Cancel / Delete sit at the top, next to the status badge.
// - Reassign sits beside the Staff field, inside the Appointment section.
// - Reschedule sits beside the Starts field, inside the Appointment section.
// There is no bottom action bar.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const STATUS_STYLE = {
  confirmed: { bg: "#e0e7ff", color: "#4338ca" },
  staff_assigned: { bg: "#dbeafe", color: "#1d4ed8" },
  rescheduled: { bg: "#fff4e0", color: "#a6650a" },
  completed: { bg: "#e6f6ec", color: "#1d8a4c" },
  cancelled: { bg: "#fdecec", color: "#c0392b" },
};

function getIdFromUrl() {
  const match = window.location.pathname.match(/records\/([^/]+)\//);
  return match ? match[1] : null;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  return (status || "unknown").replace(/_/g, " ");
}

const styles = {
  page: { maxWidth: 760, width: "100%", boxSizing: "border-box", margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
    padding: "24px 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 24,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 24 },
  headerActions: { display: "flex", gap: 8, flexShrink: 0, marginTop: 4 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: "#eef1f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 600,
    color: "#8892a6",
    flexShrink: 0,
  },
  name: { fontSize: 24, fontWeight: 700, margin: 0, color: "#1a1d24" },
  appId: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: 700,
    color: "#4f46e5",
    marginTop: 4,
  },
  statusBadge: (status) => {
    const s = STATUS_STYLE[status] || { bg: "#f0f1f4", color: "#8892a6" };
    return {
      display: "inline-block",
      marginTop: 8,
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      textTransform: "capitalize",
      background: s.bg,
      color: s.color,
    };
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#8892a6",
    marginBottom: 12,
  },
  section: { marginBottom: 32 },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  infoLabel: { fontSize: 12, color: "#8892a6", marginBottom: 2 },
  infoValue: { fontSize: 14, color: "#1a1d24" },
  clickableField: {
    cursor: "pointer",
    padding: "6px 8px",
    margin: "-6px -8px",
    borderRadius: 8,
    transition: "background 0.15s ease",
  },
  staticField: { padding: "6px 8px", margin: "-6px -8px" },
  completedNote: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1d8a4c",
    background: "#e6f6ec",
    padding: "8px 14px",
    borderRadius: 8,
  },
  link: {
    fontSize: 14,
    color: "#4f46e5",
    cursor: "pointer",
    textDecoration: "none",
  },
  chip: {
    display: "inline-block",
    background: "#eef1f7",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 13,
    marginRight: 8,
    marginBottom: 8,
    color: "#1a1d24",
  },
  verified: {
    display: "inline-block",
    background: "#e6f6ec",
    color: "#1d8a4c",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 13,
    marginRight: 8,
    marginBottom: 8,
  },
  historyRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "8px 12px",
    borderBottom: "1px solid #f0f1f4",
    fontSize: 14,
  },
  historyChange: { color: "#1a1d24", fontWeight: 500 },
  historyDetail: { color: "#8892a6", fontSize: 13 },
  historyWhen: { color: "#b0b6c3", fontSize: 13, whiteSpace: "nowrap" },
  empty: { color: "#8892a6", fontSize: 14, fontStyle: "italic" },
  loading: { color: "#8892a6", padding: 24, textAlign: "center" },
  error: {
    fontSize: 13,
    color: "#b91c1c",
    background: "#fef2f2",
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
  },
  topBtn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "1px solid #f6d5d5",
    background: "#fff",
    color: "#c0392b",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  topBtnGhost: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "1px solid transparent",
    background: "transparent",
    color: "#b0b6c3",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  inlinePanel: {
    display: "flex",
    gap: 8,
    marginTop: 10,
    maxWidth: 480,
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: "8px 10px",
    border: "1px solid #dfe2ea",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    background: "#fff",
  },
  btnPrimary: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
};

const BookingShow = (props) => {
  const [record, setRecord] = useState(props.record || null);
  const [staffOptions, setStaffOptions] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(!props.record);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState(null); // null | 'reassign' | 'reschedule'
  const [staffId, setStaffId] = useState("");
  const [newTime, setNewTime] = useState("");

  async function refreshRecord(id) {
    const res = await api.recordAction({
      resourceId: "Booking",
      recordId: id,
      actionName: "show",
    });
    setRecord(res.data.record);
  }

  async function loadOptions() {
    const [staffRes, serviceRes] = await Promise.all([
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
    ]);
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
  }

  async function loadHistory(bookingId) {
    try {
      const res = await api.resourceAction({
        resourceId: "BookingHistory",
        actionName: "list",
        params: { perPage: 500 },
      });
      const rows = (res?.data?.records || [])
        .map((r) => r.params || {})
        .filter((h) => h.bookingId === bookingId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistory(rows);
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    loadOptions();
    const id = props.record?.id || getIdFromUrl();
    if (!props.record && id) {
      refreshRecord(id).finally(() => setLoading(false));
    }
    if (id) loadHistory(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAction(actionName, data) {
    if (!record) return;
    setError("");
    setBusy(true);
    try {
      const res = await api.recordAction({
        resourceId: "Booking",
        recordId: record.id,
        actionName,
        data,
      });
      // reassignStaff / reschedule / cancelBooking / delete each already
      // do their own resource.findOne() server-side and hand back the
      // fresh record — use that directly instead of firing a second
      // "show" GET, which can come back browser-cached and mask a write
      // that actually succeeded.
      if (res?.data?.record) {
        setRecord(res.data.record);
      } else {
        await refreshRecord(record.id);
      }
      await loadHistory(record.id);
      setPanel(null);
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

  function handleCancel() {
    if (window.confirm("Cancel this booking? The customer will be notified."))
      runAction("cancelBooking", {});
  }

  function handleDelete() {
    if (window.confirm("Hide this booking? The customer is not notified.")) {
      runAction("delete", {}).then(() => {
        window.location.href = "/backoffice/resources/Booking";
      });
    }
  }

  if (loading || !record) return <div style={styles.loading}>Loading booking…</div>;

  const p = record.params || {};
  const isCompleted = p.status === "completed";
  // Direct property access — same as StaffCardList's own booking lookup
  // (`p.staffId`, `b.serviceId`). setupAdmin.js's attachBookingIds "after"
  // hook guarantees these are present on every Booking record.
  const staffName = staffOptions.find((s) => s.id === p.staffId)?.name;
  const serviceName = serviceOptions.find((s) => s.id === p.serviceId)?.name;
  const initials = (p.customerName || "?")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div style={styles.page}>
      <style>{`
        .bkd-header, .bkd-header-actions,
        .bkd-header-actions button {
          box-sizing: border-box;
        }
        .bkd-clickable-field { transition: background 0.15s ease; }
        .bkd-clickable-field:hover { background: #f0f1f5; }
        .bkd-header { flex-wrap: wrap; }
        .bkd-header-actions { flex-wrap: wrap; }
        @media (max-width: 480px) {
          .bkd-header-actions { width: 100%; max-width: 100%; margin-top: 12px; }
          .bkd-header-actions button { flex: 1; min-width: 0; }
        }
      `}</style>
      <div className="bkd-header" style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatar}>{initials}</div>
          <div>
            <h1 style={styles.name}>{p.customerName || "No name"}</h1>
            <div style={styles.appId}>{p.applicationId}</div>
            <span style={styles.statusBadge(p.status)}>{statusLabel(p.status)}</span>
            {p.deletedAt && <span style={{ ...styles.chip, marginLeft: 8 }}>Hidden</span>}
          </div>
        </div>
        {isCompleted ? (
          <div style={styles.completedNote}>Completed — no changes possible.</div>
        ) : (
          <div className="bkd-header-actions" style={styles.headerActions}>
            <button type="button" style={styles.topBtn} disabled={busy} onClick={handleCancel}>
              Cancel booking
            </button>
            <button type="button" style={styles.topBtnGhost} disabled={busy} onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Appointment</div>
        <div style={styles.infoGrid}>
          <div>
            <div style={styles.infoLabel}>Service</div>
            <div style={styles.infoValue}>
              {serviceName || (p.serviceId ? `Unknown service (${p.serviceId})` : "—")}
            </div>
          </div>
          <div>
            {isCompleted ? (
              <div style={styles.staticField}>
                <div style={styles.infoLabel}>Staff</div>
                {staffName ? (
                  <div style={{ ...styles.infoValue, fontWeight: 600 }}>{staffName}</div>
                ) : p.staffId ? (
                  <div style={styles.empty}>{`Unknown staff (${p.staffId})`}</div>
                ) : (
                  <div style={styles.empty}>Not assigned</div>
                )}
              </div>
            ) : (
              <div
                className="bkd-clickable-field"
                style={styles.clickableField}
                onClick={() => setPanel(panel === "reassign" ? null : "reassign")}
                title="Click to reassign"
              >
                <div style={styles.infoLabel}>Staff (click to change)</div>
                {staffName ? (
                  <div
                    style={{
                      ...styles.infoValue,
                      color: "#4f46e5",
                      fontWeight: 600,
                    }}
                  >
                    {staffName}
                  </div>
                ) : p.staffId ? (
                  <div style={styles.empty}>{`Unknown staff (${p.staffId})`}</div>
                ) : (
                  <div style={styles.empty}>Not assigned</div>
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
          </div>
          <div>
            {isCompleted ? (
              <div style={styles.staticField}>
                <div style={styles.infoLabel}>Starts</div>
                <div style={{ ...styles.infoValue, fontWeight: 600 }}>
                  {formatDateTime(p.startTime)}
                </div>
              </div>
            ) : (
              <div
                className="bkd-clickable-field"
                style={styles.clickableField}
                onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}
                title="Click to reschedule"
              >
                <div style={styles.infoLabel}>Starts (click to change)</div>
                <div
                  style={{
                    ...styles.infoValue,
                    color: "#4f46e5",
                    fontWeight: 600,
                  }}
                >
                  {formatDateTime(p.startTime)}
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
          </div>
          <div>
            <div style={styles.infoLabel}>Ends</div>
            <div style={styles.infoValue}>{formatTime(p.endTime)}</div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Customer</div>
        <div style={styles.infoGrid}>
          <div>
            <div style={styles.infoLabel}>Phone</div>
            <div style={styles.infoValue}>{p.customerPhone || "—"}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Email</div>
            <div style={styles.infoValue}>{p.customerEmail || "—"}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <span style={p.phoneVerified ? styles.verified : styles.chip}>
            {p.phoneVerified ? "Phone verified" : "Phone not verified"}
          </span>
          <span style={p.emailVerified ? styles.verified : styles.chip}>
            {p.emailVerified ? "Email verified" : "Email not verified"}
          </span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Record</div>
        <div style={styles.infoGrid}>
          <div>
            <div style={styles.infoLabel}>Booking ID</div>
            <div style={styles.infoValue}>{p.id}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Created</div>
            <div style={styles.infoValue}>
              {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
            </div>
          </div>
          <div>
            <div style={styles.infoLabel}>Last updated</div>
            <div style={styles.infoValue}>
              {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Change history</div>
        {!history && <div style={styles.empty}>Loading…</div>}
        {history && history.length === 0 && (
          <div style={styles.empty}>Nothing has changed since this booking was made.</div>
        )}
        {history &&
          history.map((h, i) => (
            <div key={i} style={styles.historyRow}>
              <span>
                <span style={styles.historyChange}>{statusLabel(h.changeType)}</span>
                <div style={styles.historyDetail}>
                  {h.oldValue || "—"} → {h.newValue || "—"}
                  {h.changedBy ? ` · by ${h.changedBy}` : ""}
                </div>
              </span>
              <span style={styles.historyWhen}>
                {h.createdAt ? new Date(h.createdAt).toLocaleString() : ""}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default BookingShow;
