// components/TransformationCardList.jsx
//
// Full custom "list" page for the Transformation resource. Sized to match
// ServiceCardList/PackageCardList/StaffCardList: larger before/after
// photos, more generous padding, and the same responsive stacking on
// narrow screens.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const MOBILE_BREAKPOINT = 768;

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
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
  addBtn: {
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    cursor: "pointer",
    textDecoration: "none",
  },

  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: (isMobile) => ({
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "stretch" : "center",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fff",
    padding: isMobile ? 16 : 20,
    gap: isMobile ? 16 : 24,
    cursor: "pointer",
    transition: "box-shadow 0.15s, border-color 0.15s",
  }),
  photoPair: { display: "flex", gap: 10, flexShrink: 0 },
  photoWrap: { position: "relative" },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 10,
    objectFit: "cover",
    background: "#eef1f7",
    display: "block",
  },
  photoLabel: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "#fff",
    background: "rgba(0,0,0,0.55)",
    borderRadius: 5,
    textAlign: "center",
    padding: "2px 0",
  },
  body: { flex: 1, minWidth: 0 },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  name: { fontSize: 18, fontWeight: 700, color: "#1a1d24" },
  statusBadge: (active) => ({
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: active ? "#e6f6ec" : "#fdecec",
    color: active ? "#1d8a4c" : "#c0392b",
  }),
  category: { fontSize: 14, color: "#8892a6", marginBottom: 10 },
  orderChip: {
    display: "inline-block",
    background: "#eef1f7",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12,
    color: "#1a1d24",
    fontWeight: 600,
  },
  loading: { color: "#8892a6", padding: 24, textAlign: "center" },
};

const TransformationCardList = (props) => {
  const { resource } = props;
  const [records, setRecords] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    api
      .resourceAction({
        resourceId: "Transformation",
        actionName: "list",
        params: { perPage: 500 },
      })
      .then((res) => {
        if (cancelled) return;
        const list = (res?.data?.records || []).sort(
          (a, b) => (a.params?.order ?? 0) - (b.params?.order ?? 0),
        );
        setRecords(list);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!records) return <div style={styles.loading}>Loading transformations…</div>;

  function goToShow(id) {
    window.location.href = `${resource?.href || ""}/records/${id}/show`;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Transformations</h1>
          <div style={styles.subtitle}>
            {records.length} entr{records.length === 1 ? "y" : "ies"}
          </div>
        </div>
        <a href={`${resource?.href || ""}/actions/new`} style={styles.addBtn}>
          + Add transformation
        </a>
      </div>

      {records.length === 0 ? (
        <div style={styles.loading}>No transformations yet.</div>
      ) : (
        <div style={styles.list}>
          {records.map((r) => {
            const p = r.params || {};
            return (
              <div
                key={p.id}
                style={styles.card(isMobile)}
                onClick={() => goToShow(p.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0,0,0,0.06)";
                  e.currentTarget.style.borderColor = "#c9cedb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                <div style={styles.photoPair}>
                  <div style={styles.photoWrap}>
                    {p.beforeUrl ? (
                      <img src={p.beforeUrl} alt="Before" style={styles.photo} />
                    ) : (
                      <div style={{ ...styles.photo, background: "#eef1f7" }} />
                    )}
                    <span style={styles.photoLabel}>Before</span>
                  </div>
                  <div style={styles.photoWrap}>
                    {p.afterUrl ? (
                      <img src={p.afterUrl} alt="After" style={styles.photo} />
                    ) : (
                      <div style={{ ...styles.photo, background: "#eef1f7" }} />
                    )}
                    <span style={styles.photoLabel}>After</span>
                  </div>
                </div>
                <div style={styles.body}>
                  <div style={styles.topRow}>
                    <span style={styles.name}>{p.title || "Untitled"}</span>
                    <span style={styles.statusBadge(p.active)}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {p.category && (
                    <div style={styles.category}>{p.category}</div>
                  )}
                  <span style={styles.orderChip}>Order: {p.order ?? 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TransformationCardList;
