// components/ReviewShow.jsx
//
// Full custom "show" page for a single Review. Read-only for rating,
// comment, and booking — the only actions available are the same
// reorder / show-hide controls exposed in ReviewCardList, called via the
// same hidden `reorder` / `toggleVisibility` record actions.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

function Stars({ rating }) {
  const n = Number(rating) || 0;
  return (
    <span style={{ color: "#f5a524", fontSize: 20, letterSpacing: 2 }}>
      {"★".repeat(n)}
      <span style={{ color: "#e5e7eb" }}>{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
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
  name: { fontSize: 22, fontWeight: 700, margin: 0, color: "#1a1d24" },
  visBadge: (visible) => ({
    display: "inline-block",
    marginTop: 8,
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: visible ? "#e6f6ec" : "#fdecec",
    color: visible ? "#1d8a4c" : "#c0392b",
  }),
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
  comment: {
    fontSize: 14,
    color: "#1a1d24",
    lineHeight: 1.6,
    background: "#fafbfc",
    border: "1px solid #eceef2",
    borderRadius: 8,
    padding: 14,
  },
  empty: { color: "#8892a6", fontSize: 14, fontStyle: "italic" },
  link: { fontSize: 14, color: "#4f46e5", fontWeight: 600, textDecoration: "none" },

  controlsRow: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  orderRow: { display: "flex", alignItems: "center", gap: 8 },
  orderBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    border: "1px solid #dfe2ea",
    background: "#fff",
    color: "#4b5061",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
  },
  orderValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1a1d24",
    minWidth: 24,
    textAlign: "center",
  },
  toggleBtn: (visible) => ({
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 14px",
    borderRadius: 6,
    border: visible ? "1px solid #f6d5d5" : "1px solid #cdeedb",
    background: "#fff",
    color: visible ? "#c0392b" : "#1d8a4c",
    cursor: "pointer",
  }),
  error: {
    fontSize: 13,
    color: "#b91c1c",
    background: "#fef2f2",
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
  },
};

const ReviewShow = (props) => {
  const { record: initialRecord } = props;
  const [record, setRecord] = useState(initialRecord);
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const params = record?.params || {};

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

  async function runAction(actionName, data) {
    setError("");
    setBusy(true);
    try {
      const res = await api.recordAction({
        resourceId: "Review",
        recordId: record.id,
        actionName,
        data,
      });
      if (res?.data?.record) setRecord(res.data.record);
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

  const visible = Boolean(params.approved);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.name}>{booking?.customerName || "Unknown customer"}</h1>
          <Stars rating={params.rating} />
          <div>
            <span style={styles.visBadge(visible)}>{visible ? "Visible on site" : "Hidden"}</span>
          </div>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Review</div>
        {params.comment ? (
          <div style={styles.comment}>{params.comment}</div>
        ) : (
          <div style={styles.empty}>No comment left.</div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Details</div>
        <div style={styles.infoGrid}>
          <div>
            <div style={styles.infoLabel}>Booking</div>
            {params.bookingId ? (
              <a
                style={styles.link}
                href={`/backoffice/resources/Booking/records/${params.bookingId}/show`}
              >
                {booking?.applicationId || params.bookingId}
              </a>
            ) : (
              <div style={styles.infoValue}>—</div>
            )}
          </div>
          <div>
            <div style={styles.infoLabel}>Submitted</div>
            <div style={styles.infoValue}>
              {params.createdAt ? new Date(params.createdAt).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Admin controls</div>
        <div style={styles.controlsRow}>
          <div>
            <div style={{ ...styles.infoLabel, marginBottom: 6 }}>Display order</div>
            <div style={styles.orderRow}>
              <button
                type="button"
                style={styles.orderBtn}
                disabled={busy}
                onClick={() => runAction("reorder", { direction: "up" })}
                title="Move up"
              >
                ↑
              </button>
              <span style={styles.orderValue}>{params.order ?? 0}</span>
              <button
                type="button"
                style={styles.orderBtn}
                disabled={busy}
                onClick={() => runAction("reorder", { direction: "down" })}
                title="Move down"
              >
                ↓
              </button>
            </div>
          </div>
          <div>
            <div style={{ ...styles.infoLabel, marginBottom: 6 }}>Visibility</div>
            <button
              type="button"
              style={styles.toggleBtn(visible)}
              disabled={busy}
              onClick={() => runAction("toggleVisibility", { approved: !visible })}
            >
              {visible ? "Hide from site" : "Show on site"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewShow;
