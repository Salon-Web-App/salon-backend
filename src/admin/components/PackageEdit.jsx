// components/PackageEdit.jsx
//
// Full custom "edit" page for the Package resource, matching StaffEdit's
// pattern: this replaces the entire default edit action, so it owns its
// own local state and explicitly calls the record's "new"/"edit" action
// via ApiClient to persist changes. Services are picked the same way
// StaffEdit picks services for a staff member (chips + add dropdown).

import React, { useEffect, useRef, useState } from "react";
import { CheckBox, Select } from "@adminjs/design-system";
import { ApiClient } from "adminjs";

const api = new ApiClient();

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
  photoWrap: { position: "relative", flexShrink: 0, cursor: "pointer" },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 16,
    objectFit: "cover",
    background: "#eef1f7",
    display: "block",
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
  },
  photoOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 16,
    background: "rgba(0,0,0,0.45)",
    color: "#fff",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    opacity: 0,
    transition: "opacity 0.15s",
  },
  nameInput: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1a1d24",
    border: "none",
    borderBottom: "2px solid transparent",
    outline: "none",
    padding: "2px 0",
    width: "100%",
    background: "transparent",
  },
  activeRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
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
  fieldLabel: {
    fontSize: 12,
    color: "#8892a6",
    marginBottom: 4,
    display: "block",
  },
  textInput: {
    width: "100%",
    fontSize: 14,
    padding: "8px 10px",
    border: "1px solid #dfe2ea",
    borderRadius: 6,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#eef1f7",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 13,
    marginRight: 8,
    marginBottom: 8,
    color: "#1a1d24",
  },
  removeBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
    color: "#555",
  },
  empty: { color: "#8892a6", fontSize: 14, fontStyle: "italic" },
  footer: {
    display: "flex",
    gap: 12,
    paddingTop: 20,
    marginTop: 8,
    borderTop: "1px solid #e5e7eb",
  },
  saveBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 20px",
    borderRadius: 6,
    border: "1px solid #dfe2ea",
    background: "#fff",
    color: "#333",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  error: {
    fontSize: 13,
    color: "#b91c1c",
    background: "#fef2f2",
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 16,
  },
};

const PackageEdit = (props) => {
  const { record, resource } = props;
  const isNew = !record?.id;
  const initialParams = record?.params || {};
  const fileInputRef = useRef(null);

  const [fields, setFields] = useState({
    title: initialParams.title || "",
    description: initialParams.description || "",
    originalPrice: initialParams.originalPrice ?? "",
    offerPrice: initialParams.offerPrice ?? "",
    discountLabel: initialParams.discountLabel || "",
    durationMinutes: initialParams.durationMinutes ?? "",
    message: initialParams.message || "",
    order: initialParams.order ?? 0,
    active: initialParams.active === undefined ? true : Boolean(initialParams.active),
    imageUrl: initialParams.imageUrl || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  // --- Services picker state ---
  const [allServices, setAllServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [selectedServiceIds, setSelectedServiceIds] = useState(() =>
    readArrayParam(record, "services"),
  );

  useEffect(() => {
    let cancelled = false;
    api
      .resourceAction({
        resourceId: "Service",
        actionName: "list",
        params: { perPage: 500 },
      })
      .then((response) => {
        if (cancelled) return;
        const records = response?.data?.records || [];
        setAllServices(
          records.map((r) => ({
            value: r.id ?? r.params?.id,
            label: r.params?.name || `Service ${r.id}`,
          })),
        );
        setServicesLoading(false);
      })
      .catch(() => setServicesLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedServices = allServices.filter((s) => selectedServiceIds.includes(s.value));
  const availableServiceOptions = allServices.filter((s) => !selectedServiceIds.includes(s.value));

  function handleAddService(selected) {
    if (!selected) return;
    const value = selected.value !== undefined ? selected.value : selected;
    if (selectedServiceIds.includes(value)) return;
    setSelectedServiceIds((prev) => [...prev, value]);
  }

  function handleRemoveService(value) {
    setSelectedServiceIds((prev) => prev.filter((id) => id !== value));
  }

  function handlePhotoPick() {
    fileInputRef.current?.click();
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("imageUrl", reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const data = {
        title: fields.title,
        description: fields.description,
        originalPrice: fields.originalPrice,
        offerPrice: fields.offerPrice,
        discountLabel: fields.discountLabel,
        durationMinutes: fields.durationMinutes,
        message: fields.message,
        order: fields.order,
        active: fields.active,
        imageUrl: fields.imageUrl,
        services: selectedServiceIds,
      };

      if (isNew) {
        const res = await api.resourceAction({
          resourceId: "Package",
          actionName: "new",
          data,
        });
        const newId = res?.data?.record?.params?.id;
        window.location.href = newId
          ? `${resource?.href || ""}/records/${newId}/show`
          : resource?.href || "";
      } else {
        await api.recordAction({
          resourceId: "Package",
          recordId: record.id,
          actionName: "edit",
          data,
        });
        window.location.href = `${resource?.href || ""}/records/${record.id}/show`;
      }
    } catch (err) {
      setError(
        err?.response?.data?.errors?.[0]?.message ||
          err.message ||
          (isNew ? "Failed to create package" : "Failed to save changes"),
      );
      setSaving(false);
    }
  }

  function handleCancel() {
    window.location.href = isNew
      ? resource?.href || ""
      : `${resource?.href || ""}/records/${record.id}/show`;
  }

  return (
    <div style={styles.page}>
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.header}>
        <div
          style={styles.photoWrap}
          onClick={handlePhotoPick}
          onMouseEnter={(e) => {
            const overlay = e.currentTarget.querySelector("[data-overlay]");
            if (overlay) overlay.style.opacity = 1;
          }}
          onMouseLeave={(e) => {
            const overlay = e.currentTarget.querySelector("[data-overlay]");
            if (overlay) overlay.style.opacity = 0;
          }}
        >
          {fields.imageUrl ? (
            <img src={fields.imageUrl} alt={fields.title} style={styles.photo} />
          ) : (
            <div style={styles.photoPlaceholder}>
              {(fields.title || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div data-overlay style={styles.photoOverlay}>
            Change
            <br />
            photo
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <input
            style={styles.nameInput}
            value={fields.title}
            placeholder="Package title"
            onChange={(e) => setField("title", e.target.value)}
          />
          <div style={styles.activeRow}>
            <CheckBox
              id="package-active"
              checked={fields.active}
              onChange={() => setField("active", !fields.active)}
            />
            <label htmlFor="package-active" style={{ fontSize: 13, color: "#555" }}>
              Active
            </label>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Pricing</div>
        <div style={styles.infoGrid}>
          <div>
            <label style={styles.fieldLabel}>Original price (Rs.)</label>
            <input
              type="number"
              style={styles.textInput}
              value={fields.originalPrice}
              onChange={(e) => setField("originalPrice", e.target.value)}
            />
          </div>
          <div>
            <label style={styles.fieldLabel}>Offer price (Rs.)</label>
            <input
              type="number"
              style={styles.textInput}
              value={fields.offerPrice}
              onChange={(e) => setField("offerPrice", e.target.value)}
            />
          </div>
          <div>
            <label style={styles.fieldLabel}>Discount label</label>
            <input
              style={styles.textInput}
              placeholder="e.g. 20% OFF"
              value={fields.discountLabel}
              onChange={(e) => setField("discountLabel", e.target.value)}
            />
          </div>
          <div>
            <label style={styles.fieldLabel}>Duration (minutes)</label>
            <input
              type="number"
              style={styles.textInput}
              value={fields.durationMinutes}
              onChange={(e) => setField("durationMinutes", e.target.value)}
            />
          </div>
          <div>
            <label style={styles.fieldLabel}>Message</label>
            <input
              style={styles.textInput}
              placeholder="e.g. Limited Time Offer"
              value={fields.message}
              onChange={(e) => setField("message", e.target.value)}
            />
          </div>
          <div>
            <label style={styles.fieldLabel}>Display order</label>
            <input
              type="number"
              style={styles.textInput}
              value={fields.order}
              onChange={(e) => setField("order", e.target.value)}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={styles.fieldLabel}>Description</label>
            <textarea
              style={{ ...styles.textInput, minHeight: 80, resize: "vertical" }}
              value={fields.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Included services</div>
        <div style={{ marginBottom: 12 }}>
          {selectedServices.length === 0 && (
            <span style={styles.empty}>No services included yet.</span>
          )}
          {selectedServices.map((s) => (
            <span key={s.value} style={styles.chip}>
              {s.label}
              <button
                type="button"
                style={styles.removeBtn}
                onClick={() => handleRemoveService(s.value)}
                aria-label={`Remove ${s.label}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <Select
          isLoading={servicesLoading}
          placeholder={
            availableServiceOptions.length ? "Add a service…" : "All services are already included"
          }
          options={availableServiceOptions}
          value={null}
          onChange={handleAddService}
          isDisabled={availableServiceOptions.length === 0 || servicesLoading}
          isClearable={false}
        />
      </div>

      <div style={styles.footer}>
        <button
          type="button"
          style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button type="button" style={styles.cancelBtn} disabled={saving} onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PackageEdit;
