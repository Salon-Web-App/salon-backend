// components/BookingHistoryShow.jsx
//
// Full custom "show" page for a single BookingHistory entry — read only,
// same profile-style section layout as the other Show pages, plus a
// link back to the booking this entry belongs to.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

function statusLabel(status) {
  return (status || "unknown").replace(/_/g, " ");
}

const CHANGE_STYLE = {
  staff_assigned: { bg: "#dbeafe", color: "#1d4ed8" },
  reschedule: { bg: "#fff4e0", color: "#a6650a" },
  status_change: { bg: "#e0e7ff", color: "#4338ca" },
  soft_deleted: { bg: "#fdecec", color: "#c0392b" },
};

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
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: "#1a1d24" },
  badge: (type) => {
    const s = CHANGE_STYLE[type] || { bg: "#f0f1f4", color: "#8892a6" };
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
  link: {
    fontSize: 14,
    color: "#4f46e5",
    fontWeight: 600,
    textDecoration: "none",
  },
  empty: { color: "#8892a6", fontSize: 14, fontStyle: "italic" },
};

const BookingHistoryShow = (props) => {
  const { record } = props;
  const params = record?.params || {};
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    if (!params.bookingId) return;
    let cancelled = false;
    api
      .recordAction({
        resourceId: "Booking",
        recordId: params.bookingId,
        actionName: "show",
      })
      .then((res) => {
        if (!cancelled) setBooking(res?.data?.record?.params || null);
      })
      .catch(() => setBooking(null));
    return () => {
      cancelled = true;
    };
  }, [params.bookingId]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{statusLabel(params.changeType)}</h1>
          <span style={styles.badge(params.changeType)}>{statusLabel(params.changeType)}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Change</div>
        <div style={styles.infoGrid}>
          <div>
            <div style={styles.infoLabel}>Old value</div>
            <div style={styles.infoValue}>{params.oldValue || "—"}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>New value</div>
            <div style={styles.infoValue}>{params.newValue || "—"}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Changed by</div>
            <div style={styles.infoValue}>{params.changedBy || "—"}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>When</div>
            <div style={styles.infoValue}>
              {params.createdAt ? new Date(params.createdAt).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Booking</div>
        {!booking && <div style={styles.empty}>Loading…</div>}
        {booking && (
          <div style={styles.infoGrid}>
            <div>
              <div style={styles.infoLabel}>Customer</div>
              <div style={styles.infoValue}>{booking.customerName || "—"}</div>
            </div>
            <div>
              <div style={styles.infoLabel}>Application ID</div>
              <a
                style={styles.link}
                href={`/backoffice/resources/Booking/records/${params.bookingId}/show`}
              >
                {booking.applicationId || params.bookingId}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingHistoryShow;
