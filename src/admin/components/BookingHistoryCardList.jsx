// components/BookingHistoryCardList.jsx
//
// Full custom "list" page for the BookingHistory resource — a read-only
// audit log, so unlike BookingCardList there are no action buttons here,
// just a clean stacked list of change entries with the linked booking's
// customer/application id resolved for context. new/edit/delete are all
// isVisible:false for this resource in setupAdmin.js.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const CHANGE_STYLE = {
  staff_assigned: { bg: "#dbeafe", color: "#1d4ed8" },
  reschedule: { bg: "#fff4e0", color: "#a6650a" },
  status_change: { bg: "#e0e7ff", color: "#4338ca" },
  soft_deleted: { bg: "#fdecec", color: "#c0392b" },
};

function statusLabel(status) {
  return (status || "unknown").replace(/_/g, " ");
}

function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
    minWidth: 180,
  },

  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fff",
    padding: "14px 18px",
    cursor: "pointer",
    textDecoration: "none",
    color: "inherit",
    transition: "box-shadow 0.15s, border-color 0.15s",
  },
  rowLeft: { flex: 1, minWidth: 0 },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  changeBadge: (type) => {
    const s = CHANGE_STYLE[type] || { bg: "#f0f1f4", color: "#8892a6" };
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
  customer: { fontSize: 14, fontWeight: 700, color: "#1a1d24" },
  appId: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: 700,
    color: "#4f46e5",
  },
  detail: { fontSize: 13, color: "#8892a6" },
  when: { fontSize: 12, color: "#b0b6c3", whiteSpace: "nowrap" },
  loading: { color: "#8892a6", padding: 24, textAlign: "center" },
  empty: { color: "#8892a6", padding: 24, textAlign: "center" },
};

const BookingHistoryCardList = (props) => {
  const { resource } = props;
  const [entries, setEntries] = useState(null);
  const [bookings, setBookings] = useState({});
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.resourceAction({
        resourceId: "BookingHistory",
        actionName: "list",
        params: { perPage: 1000 },
      }),
      api
        .resourceAction({
          resourceId: "Booking",
          actionName: "list",
          params: { perPage: 1000 },
        })
        .catch(() => ({ data: { records: [] } })),
    ]).then(([historyRes, bookingRes]) => {
      if (cancelled) return;
      const byId = {};
      (bookingRes?.data?.records || []).forEach((b) => {
        byId[b.params?.id] = {
          customerName: b.params?.customerName,
          applicationId: b.params?.applicationId,
        };
      });
      setBookings(byId);
      const rows = (historyRes?.data?.records || [])
        .sort(
          (a, b) =>
            new Date(b.params?.createdAt) - new Date(a.params?.createdAt),
        );
      setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!entries)
    return <div style={styles.loading}>Loading booking history…</div>;

  const changeTypes = Array.from(
    new Set(entries.map((e) => e.params?.changeType).filter(Boolean)),
  );

  const visible = entries.filter((e) =>
    typeFilter === "all" ? true : e.params?.changeType === typeFilter,
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Booking History</h1>
          <div style={styles.subtitle}>
            {entries.length} change{entries.length === 1 ? "" : "s"} logged
          </div>
        </div>
      </div>

      <div style={styles.filterRow}>
        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Change type</label>
          <select
            style={styles.filterSelect}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All</option>
            {changeTypes.map((t) => (
              <option key={t} value={t}>
                {statusLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={styles.empty}>No history entries match this filter.</div>
      ) : (
        <div style={styles.list}>
          {visible.map((e) => {
            const p = e.params || {};
            const booking = bookings[p.bookingId];
            return (
              <div
                key={p.id}
                style={styles.row}
                onClick={() => {
                  window.location.href = `${resource?.href || ""}/records/${p.id}/show`;
                }}
                onMouseEnter={(ev) => {
                  ev.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0,0,0,0.06)";
                  ev.currentTarget.style.borderColor = "#c9cedb";
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.boxShadow = "none";
                  ev.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                <div style={styles.rowLeft}>
                  <div style={styles.topRow}>
                    <span style={styles.changeBadge(p.changeType)}>
                      {statusLabel(p.changeType)}
                    </span>
                    <span style={styles.customer}>
                      {booking?.customerName || "Unknown customer"}
                    </span>
                    {booking?.applicationId && (
                      <span style={styles.appId}>{booking.applicationId}</span>
                    )}
                  </div>
                  <div style={styles.detail}>
                    {p.oldValue || "—"} → {p.newValue || "—"}
                    {p.changedBy ? ` · by ${p.changedBy}` : ""}
                  </div>
                </div>
                <div style={styles.when}>{formatWhen(p.createdAt)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BookingHistoryCardList;
