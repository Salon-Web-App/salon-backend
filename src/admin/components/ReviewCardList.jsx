// components/ReviewCardList.jsx
//
// Full custom "list" page for the Review resource. Reviews are never
// hand-edited (rating/comment/booking are all set by the customer) — the
// only things an admin can change here are display order (via Move
// up/down, mirroring the reference design's "click to change" panel
// pattern) and visibility on the public site (Show/Hide, reusing the
// existing `approved` flag as the show/hide switch). new/edit are
// isVisible:false for this resource in setupAdmin.js.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Stars({ rating }) {
  const n = Number(rating) || 0;
  return (
    <span style={{ color: "#f5a524", fontSize: 14, letterSpacing: 1 }}>
      {"★".repeat(n)}
      <span style={{ color: "#e5e7eb" }}>{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
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

  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    display: "flex",
    alignItems: "stretch",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fff",
    transition: "box-shadow 0.15s, border-color 0.15s",
    overflow: "hidden",
  },
  cardHidden: { opacity: 0.6 },
  main: { flex: 1, minWidth: 0, padding: 18, cursor: "pointer" },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  customer: { fontSize: 15, fontWeight: 700, color: "#1a1d24" },
  visBadge: (visible) => ({
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: visible ? "#e6f6ec" : "#fdecec",
    color: visible ? "#1d8a4c" : "#c0392b",
  }),
  comment: { fontSize: 13, color: "#4b5061", lineHeight: 1.5, marginTop: 6 },
  empty: { color: "#b0b6c3", fontSize: 13, fontStyle: "italic" },
  when: { fontSize: 12, color: "#b0b6c3", marginTop: 8 },
  loading: { color: "#8892a6", padding: 24, textAlign: "center" },
  error: {
    fontSize: 13,
    color: "#b91c1c",
    background: "#fef2f2",
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
  },

  panel: {
    width: 170,
    flexShrink: 0,
    borderLeft: "1px solid #eceef2",
    background: "#fafbfc",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  orderRow: { display: "flex", alignItems: "center", gap: 8 },
  orderBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid #dfe2ea",
    background: "#fff",
    color: "#4b5061",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,
  },
  orderValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1a1d24",
    minWidth: 20,
    textAlign: "center",
  },
  panelLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#8892a6",
  },
  toggleBtn: (visible) => ({
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 10px",
    borderRadius: 6,
    border: visible ? "1px solid #f6d5d5" : "1px solid #cdeedb",
    background: "#fff",
    color: visible ? "#c0392b" : "#1d8a4c",
    cursor: "pointer",
  }),
};

const ReviewCardList = (props) => {
  const { resource } = props;
  const [reviews, setReviews] = useState(null);
  const [bookings, setBookings] = useState({});
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError("");
    try {
      const [reviewRes, bookingRes] = await Promise.all([
        api.resourceAction({
          resourceId: "Review",
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
      ]);
      const byId = {};
      (bookingRes?.data?.records || []).forEach((b) => {
        byId[b.params?.id] = b.params?.customerName;
      });
      setBookings(byId);
      const rows = (reviewRes?.data?.records || []).sort(
        (a, b) => (a.params?.order ?? 0) - (b.params?.order ?? 0),
      );
      setReviews(rows);
    } catch (err) {
      setReviews([]);
      setError(err.message || "Reviews could not be loaded. Refresh to retry.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function runAction(id, actionName, data) {
    setError("");
    setBusyId(id);
    try {
      await api.recordAction({
        resourceId: "Review",
        recordId: id,
        actionName,
        data,
      });
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.errors?.[0]?.message ||
          err.message ||
          "That action could not be completed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!reviews) return <div style={styles.loading}>Loading reviews…</div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Reviews</h1>
          <div style={styles.subtitle}>
            {reviews.length} review{reviews.length === 1 ? "" : "s"} ·{" "}
            {reviews.filter((r) => r.params?.approved).length} visible on site
          </div>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {reviews.length === 0 ? (
        <div style={styles.loading}>No reviews yet.</div>
      ) : (
        <div style={styles.list}>
          {reviews.map((r) => {
            const p = r.params || {};
            const visible = Boolean(p.approved);
            const busy = busyId === p.id;
            return (
              <div
                key={p.id}
                style={{ ...styles.card, ...(visible ? {} : styles.cardHidden) }}
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
                  style={styles.main}
                  onClick={() => {
                    window.location.href = `${resource?.href || ""}/records/${p.id}/show`;
                  }}
                >
                  <div style={styles.topRow}>
                    <span style={styles.customer}>
                      {bookings[p.bookingId] || "Unknown customer"}
                    </span>
                    <Stars rating={p.rating} />
                    <span style={styles.visBadge(visible)}>{visible ? "Visible" : "Hidden"}</span>
                  </div>
                  <div style={p.comment ? styles.comment : styles.empty}>
                    {p.comment || "No comment left."}
                  </div>
                  <div style={styles.when}>{formatWhen(p.createdAt)}</div>
                </div>

                <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.panelLabel}>Display order</div>
                  <div style={styles.orderRow}>
                    <button
                      type="button"
                      style={styles.orderBtn}
                      disabled={busy}
                      onClick={() => runAction(p.id, "reorder", { direction: "up" })}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <span style={styles.orderValue}>{p.order ?? 0}</span>
                    <button
                      type="button"
                      style={styles.orderBtn}
                      disabled={busy}
                      onClick={() => runAction(p.id, "reorder", { direction: "down" })}
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>

                  <div style={{ ...styles.panelLabel, marginTop: 6 }}>Visibility</div>
                  <button
                    type="button"
                    style={styles.toggleBtn(visible)}
                    disabled={busy}
                    onClick={() => runAction(p.id, "toggleVisibility", { approved: !visible })}
                  >
                    {visible ? "Hide from site" : "Show on site"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewCardList;
