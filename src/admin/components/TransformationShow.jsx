// components/TransformationShow.jsx
//
// Full custom "show" page for the Transformation resource: large
// before/after photo pair up top, details grid below, matching the
// profile-style layout used across the other Show pages.

import React from "react";

const styles = {
  page: { maxWidth: 760, width: "100%", boxSizing: "border-box", margin: "0 auto" },
  photoPairWrap: {
    display: "flex",
    gap: 12,
    padding: "24px 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 24,
  },
  photoWrap: { position: "relative", flex: 1 },
  photo: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    objectFit: "cover",
    background: "#eef1f7",
    display: "block",
  },
  photoLabel: {
    position: "absolute",
    bottom: 8,
    left: 8,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#fff",
    background: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    padding: "2px 8px",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  name: { fontSize: 22, fontWeight: 700, margin: 0, color: "#1a1d24" },
  statusBadge: (active) => ({
    display: "inline-block",
    marginTop: 8,
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: active ? "#e6f6ec" : "#fdecec",
    color: active ? "#1d8a4c" : "#c0392b",
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
  editBtn: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
  },
};

const TransformationShow = (props) => {
  const { record, resource } = props;
  const params = record?.params || {};

  return (
    <div style={styles.page}>
      <div style={styles.photoPairWrap}>
        <div style={styles.photoWrap}>
          {params.beforeUrl && (
            <img src={params.beforeUrl} alt="Before" style={styles.photo} />
          )}
          <span style={styles.photoLabel}>Before</span>
        </div>
        <div style={styles.photoWrap}>
          {params.afterUrl && (
            <img src={params.afterUrl} alt="After" style={styles.photo} />
          )}
          <span style={styles.photoLabel}>After</span>
        </div>
      </div>

      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.name}>{params.title || "Untitled"}</h1>
          <span style={styles.statusBadge(params.active)}>
            {params.active ? "Active" : "Inactive"}
          </span>
        </div>
        <a
          href={`${resource?.href || ""}/records/${params.id}/edit`}
          style={styles.editBtn}
        >
          Edit
        </a>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Details</div>
        <div style={styles.infoGrid}>
          <div>
            <div style={styles.infoLabel}>Category</div>
            <div style={styles.infoValue}>{params.category || "—"}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Display order</div>
            <div style={styles.infoValue}>{params.order ?? 0}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Created</div>
            <div style={styles.infoValue}>
              {params.createdAt
                ? new Date(params.createdAt).toLocaleDateString()
                : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransformationShow;
