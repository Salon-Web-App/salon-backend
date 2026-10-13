// components/ServiceEdit.jsx
//
// Full custom "edit" page for the Service resource, matching StaffEdit's
// pattern: this replaces the entire default edit action, so it owns its
// own local state and explicitly calls the record's "new"/"edit" action
// via ApiClient to persist changes. The image is read as base64 here;
// the actual Cloudinary upload happens server-side in the matching
// `before` hook (makePhotoUploadHook) already wired in setupAdmin.js.

import React, { useRef, useState } from "react";
import { CheckBox, Select } from "@adminjs/design-system";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const ICON_OPTIONS = [
  { value: "crown", label: "Crown (Bridal)" },
  { value: "sparkles", label: "Sparkles (Facial/Skin)" },
  { value: "scissors", label: "Scissors (Hair Cut)" },
  { value: "palette", label: "Palette (Makeup)" },
  { value: "hand", label: "Hand (Nails)" },
  { value: "heart", label: "Heart (Body/Spa)" },
  { value: "eye", label: "Eye (Lash/Brow)" },
  { value: "droplet", label: "Droplet (Hair Treatment)" },
];

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

const ServiceEdit = (props) => {
  const { record, resource } = props;
  const isNew = !record?.id;
  const initialParams = record?.params || {};
  const fileInputRef = useRef(null);

  const [fields, setFields] = useState({
    name: initialParams.name || "",
    description: initialParams.description || "",
    category: initialParams.category || "",
    icon: initialParams.icon || "",
    price: initialParams.price ?? "",
    durationMinutes: initialParams.durationMinutes ?? "",
    active: initialParams.active === undefined ? true : Boolean(initialParams.active),
    imageUrl: initialParams.imageUrl || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
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
        name: fields.name,
        description: fields.description,
        category: fields.category,
        icon: fields.icon,
        price: fields.price,
        durationMinutes: fields.durationMinutes,
        active: fields.active,
        imageUrl: fields.imageUrl,
      };

      if (isNew) {
        const res = await api.resourceAction({
          resourceId: "Service",
          actionName: "new",
          data,
        });
        const newId = res?.data?.record?.params?.id;
        window.location.href = newId
          ? `${resource?.href || ""}/records/${newId}/show`
          : resource?.href || "";
      } else {
        await api.recordAction({
          resourceId: "Service",
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
          (isNew ? "Failed to create service" : "Failed to save changes"),
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
            <img src={fields.imageUrl} alt={fields.name} style={styles.photo} />
          ) : (
            <div style={styles.photoPlaceholder}>
              {(fields.name || "?").slice(0, 1).toUpperCase()}
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
            value={fields.name}
            placeholder="Service name"
            onChange={(e) => setField("name", e.target.value)}
          />
          <div style={styles.activeRow}>
            <CheckBox
              id="service-active"
              checked={fields.active}
              onChange={() => setField("active", !fields.active)}
            />
            <label
              htmlFor="service-active"
              style={{ fontSize: 13, color: "#555" }}
            >
              Active
            </label>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Details</div>
        <div style={styles.infoGrid}>
          <div>
            <label style={styles.fieldLabel}>Category</label>
            <input
              style={styles.textInput}
              value={fields.category}
              onChange={(e) => setField("category", e.target.value)}
            />
          </div>
          <div>
            <label style={styles.fieldLabel}>Icon</label>
            <Select
              options={ICON_OPTIONS}
              value={ICON_OPTIONS.find((o) => o.value === fields.icon) || null}
              onChange={(opt) => setField("icon", opt?.value || "")}
              isClearable
            />
          </div>
          <div>
            <label style={styles.fieldLabel}>Price (Rs.)</label>
            <input
              type="number"
              style={styles.textInput}
              value={fields.price}
              onChange={(e) => setField("price", e.target.value)}
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

      <div style={styles.footer}>
        <button
          type="button"
          style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          style={styles.cancelBtn}
          disabled={saving}
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ServiceEdit;
