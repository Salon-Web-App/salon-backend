// components/PackageShow.jsx
//
// Full custom "show" page for the Package resource. Same profile-style
// layout as ServiceShow: image + title + status at the top, pricing and
// validity in a clean grid, and included services rendered as badges.

import React from "react";

function readArrayParam(record, propertyName) {
  const params = record?.params || {};
  if (Array.isArray(params[propertyName])) return params[propertyName];

  const idKeyPattern = new RegExp(`^${propertyName}\\.(\\d+)\\.id$`);
  const idEntries = Object.keys(params)
    .map((key) => {
      const match = key.match(idKeyPattern);
      return match ? { index: Number(match[1]), id: params[key] } : null;
    })
    .filter(Boolean);
  if (idEntries.length) {
    return idEntries
      .sort((a, b) => a.index - b.index)
      .map((e) => e.id)
      .filter(Boolean);
  }

  const flatPrefix = `${propertyName}.`;
  return Object.keys(params)
    .filter((key) => key.startsWith(flatPrefix) && /^\d+$/.test(key.slice(flatPrefix.length)))
    .sort((a, b) => Number(a.slice(flatPrefix.length)) - Number(b.slice(flatPrefix.length)))
    .map((key) => params[key])
    .filter((v) => v !== undefined && v !== null && v !== "");
}

// Populated Service relations come back the same flattened way Staff's
// services relation does — `services.0.id`, `services.0.name`, ... —
// so names can often be read straight off the record without a
// second fetch.
function readServiceNames(record) {
  const params = record?.params || {};
  const namePattern = /^services\.(\d+)\.name$/;
  const entries = Object.keys(params)
    .map((key) => {
      const match = key.match(namePattern);
      return match ? { index: Number(match[1]), name: params[key] } : null;
    })
    .filter(Boolean);
  if (entries.length) {
    return entries.sort((a, b) => a.index - b.index).map((e) => e.name);
  }
  return null;
}

function formatPrice(price) {
  if (price === undefined || price === null || price === "") return "—";
  const n = Number(price);
  return Number.isNaN(n) ? "—" : `Rs. ${n.toLocaleString()}`;
}

function formatDuration(minutes) {
  const n = Number(minutes);
  if (!n) return "—";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const styles = {
  page: { maxWidth: 760, width: "100%", boxSizing: "border-box", margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "24px 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 24,
  },
  headerActions: { marginLeft: "auto", display: "flex", gap: 8 },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 16,
    objectFit: "cover",
    background: "#eef1f7",
    flexShrink: 0,
  },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 16,
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
  discountBadge: {
    display: "inline-block",
    marginTop: 8,
    marginLeft: 8,
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: "#fff4e0",
    color: "#a6650a",
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
  empty: { color: "#8892a6", fontSize: 14, fontStyle: "italic" },
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

const PackageShow = (props) => {
  const { record, resource } = props;
  const params = record?.params || {};
  const serviceIds = readArrayParam(record, "services");
  const flattenedNames = readServiceNames(record);
  const serviceNames = flattenedNames || [];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        {params.imageUrl ? (
          <img src={params.imageUrl} alt={params.title} style={styles.photo} />
        ) : (
          <div style={styles.photoPlaceholder}>
            {(params.title || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 style={styles.name}>{params.title || "Untitled package"}</h1>
          <span style={styles.statusBadge(params.active)}>
            {params.active ? "Active" : "Inactive"}
          </span>
          {params.discountLabel && <span style={styles.discountBadge}>{params.discountLabel}</span>}
        </div>
        <div style={styles.headerActions}>
          <a href={`${resource?.href || ""}/records/${params.id}/edit`} style={styles.editBtn}>
            Edit
          </a>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Pricing</div>
        <div style={styles.infoGrid}>
          <div>
            <div style={styles.infoLabel}>Offer price</div>
            <div style={{ ...styles.infoValue, fontWeight: 700 }}>
              {formatPrice(params.offerPrice)}
            </div>
          </div>
          <div>
            <div style={styles.infoLabel}>Original price</div>
            <div style={styles.infoValue}>{formatPrice(params.originalPrice)}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Duration</div>
            <div style={styles.infoValue}>{formatDuration(params.durationMinutes)}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Message</div>
            <div style={styles.infoValue}>{params.message || "—"}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Display order</div>
            <div style={styles.infoValue}>{params.order ?? 0}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Created</div>
            <div style={styles.infoValue}>
              {params.createdAt ? new Date(params.createdAt).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={styles.infoLabel}>Description</div>
          <div style={styles.infoValue}>{params.description || "—"}</div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Included services</div>
        {serviceIds.length === 0 && <div style={styles.empty}>No services included.</div>}
        {serviceIds.length > 0 &&
          (serviceNames.length > 0 ? (
            serviceNames.map((name) => (
              <span key={name} style={styles.chip}>
                {name}
              </span>
            ))
          ) : (
            <div style={styles.empty}>{serviceIds.length} service(s) included.</div>
          ))}
      </div>
    </div>
  );
};

export default PackageShow;
