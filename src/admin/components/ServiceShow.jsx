// components/ServiceShow.jsx
//
// Full custom "show" page for the Service resource. Same profile-style
// layout as StaffShow: image + name + status at the top, key info in a
// clean grid, and the list of staff members who offer this service.

import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const ICON_LABELS = {
  crown: "Crown (Bridal)",
  sparkles: "Sparkles (Facial/Skin)",
  scissors: "Scissors (Hair Cut)",
  palette: "Palette (Makeup)",
  hand: "Hand (Nails)",
  heart: "Heart (Body/Spa)",
  eye: "Eye (Lash/Brow)",
  droplet: "Droplet (Hair Treatment)",
};

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

const ServiceShow = (props) => {
  const { record, resource } = props;
  const params = record?.params || {};
  const [staffNames, setStaffNames] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .resourceAction({
        resourceId: "Staff",
        actionName: "list",
        params: { perPage: 200 },
      })
      .then((res) => {
        if (cancelled) return;
        const names = (res?.data?.records || [])
          .filter((s) =>
            (Array.isArray(s.params?.services) ? s.params.services : []).includes(
              params.id,
            ),
          )
          .map((s) => s.params?.name)
          .filter(Boolean);
        setStaffNames(names);
      })
      .catch(() => setStaffNames([]));
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        {params.imageUrl ? (
          <img src={params.imageUrl} alt={params.name} style={styles.photo} />
        ) : (
          <div style={styles.photoPlaceholder}>
            {(params.name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 style={styles.name}>{params.name || "Unnamed service"}</h1>
          {params.category && (
            <div style={{ fontSize: 14, color: "#8892a6", marginTop: 4 }}>
              {params.category}
            </div>
          )}
          <span style={styles.statusBadge(params.active)}>
            {params.active ? "Active" : "Inactive"}
          </span>
        </div>
        <div style={styles.headerActions}>
          <a
            href={`${resource?.href || ""}/records/${params.id}/edit`}
            style={styles.editBtn}
          >
            Edit
          </a>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Details</div>
        <div style={styles.infoGrid}>
          <div>
            <div style={styles.infoLabel}>Price</div>
            <div style={styles.infoValue}>{formatPrice(params.price)}</div>
          </div>
          <div>
            <div style={styles.infoLabel}>Duration</div>
            <div style={styles.infoValue}>
              {formatDuration(params.durationMinutes)}
            </div>
          </div>
          <div>
            <div style={styles.infoLabel}>Icon</div>
            <div style={styles.infoValue}>
              {ICON_LABELS[params.icon] || params.icon || "—"}
            </div>
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
        <div style={{ marginTop: 16 }}>
          <div style={styles.infoLabel}>Description</div>
          <div style={styles.infoValue}>{params.description || "—"}</div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Staff offering this service</div>
        {staffNames === null && <div style={styles.empty}>Loading…</div>}
        {staffNames && staffNames.length === 0 && (
          <div style={styles.empty}>No staff assigned yet.</div>
        )}
        {staffNames &&
          staffNames.length > 0 &&
          staffNames.map((name) => (
            <span key={name} style={styles.chip}>
              {name}
            </span>
          ))}
      </div>
    </div>
  );
};

export default ServiceShow;
