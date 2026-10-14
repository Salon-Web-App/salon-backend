// components/TransformationEdit.jsx
//
// Full custom "edit" page for the Transformation resource, matching
// StaffEdit/ServiceEdit's pattern: this replaces the entire default edit
// action, owns its own local state, and calls the record's "new"/"edit"
// action via ApiClient directly. Both photos are read as base64 here;
// the actual Cloudinary upload happens server-side in the matching
// `before` hooks (makePhotoUploadHook) already wired in setupAdmin.js.

import React, { useRef, useState } from "react";
import { CheckBox } from "@adminjs/design-system";
import { ApiClient } from "adminjs";

const api = new ApiClient();

const styles = {
  page: { maxWidth: 760, width: "100%", boxSizing: "border-box", margin: "0 auto" },
  photoPairWrap: {
    display: "flex",
    gap: 12,
    padding: "24px 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 24,
  },
  photoWrap: { position: "relative", flex: 1, cursor: "pointer" },
  photo: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    objectFit: "cover",
    background: "#eef1f7",
    display: "block",
  },
  photoPlaceholder: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 12,
    background: "#eef1f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    color: "#8892a6",
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
  photoOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 12,
    background: "rgba(0,0,0,0.35)",
    color: "#fff",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
    marginBottom: 12,
  },
  activeRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 24 },
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

function PhotoPicker({ label, value, onPick }) {
  const fileInputRef = useRef(null);
  return (
    <div
      style={styles.photoWrap}
      onClick={() => fileInputRef.current?.click()}
      onMouseEnter={(e) => {
        const overlay = e.currentTarget.querySelector("[data-overlay]");
        if (overlay) overlay.style.opacity = 1;
      }}
      onMouseLeave={(e) => {
        const overlay = e.currentTarget.querySelector("[data-overlay]");
        if (overlay) overlay.style.opacity = 0;
      }}
    >
      {value ? (
        <img src={value} alt={label} style={styles.photo} />
      ) : (
        <div style={styles.photoPlaceholder}>Click to upload</div>
      )}
      <span style={styles.photoLabel}>{label}</span>
      <div data-overlay style={styles.photoOverlay}>
        Change photo
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onPick(reader.result);
          reader.readAsDataURL(file);
        }}
        style={{ display: "none" }}
      />
    </div>
  );
}

const TransformationEdit = (props) => {
  const { record, resource } = props;
  const isNew = !record?.id;
  const initialParams = record?.params || {};

  const [fields, setFields] = useState({
    title: initialParams.title || "",
    category: initialParams.category || "",
    order: initialParams.order ?? 0,
    active: initialParams.active === undefined ? true : Boolean(initialParams.active),
    beforeUrl: initialParams.beforeUrl || "",
    afterUrl: initialParams.afterUrl || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const data = {
        title: fields.title,
        category: fields.category,
        order: fields.order,
        active: fields.active,
        beforeUrl: fields.beforeUrl,
        afterUrl: fields.afterUrl,
      };

      if (isNew) {
        const res = await api.resourceAction({
          resourceId: "Transformation",
          actionName: "new",
          data,
        });
        const newId = res?.data?.record?.params?.id;
        window.location.href = newId
          ? `${resource?.href || ""}/records/${newId}/show`
          : resource?.href || "";
      } else {
        await api.recordAction({
          resourceId: "Transformation",
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
          (isNew ? "Failed to create transformation" : "Failed to save changes"),
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

      <div style={styles.photoPairWrap}>
        <PhotoPicker
          label="Before"
          value={fields.beforeUrl}
          onPick={(url) => setField("beforeUrl", url)}
        />
        <PhotoPicker
          label="After"
          value={fields.afterUrl}
          onPick={(url) => setField("afterUrl", url)}
        />
      </div>

      <input
        style={styles.nameInput}
        value={fields.title}
        placeholder="Transformation title"
        onChange={(e) => setField("title", e.target.value)}
      />
      <div style={styles.activeRow}>
        <CheckBox
          id="transformation-active"
          checked={fields.active}
          onChange={() => setField("active", !fields.active)}
        />
        <label htmlFor="transformation-active" style={{ fontSize: 13, color: "#555" }}>
          Active
        </label>
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
            <label style={styles.fieldLabel}>Display order</label>
            <input
              type="number"
              style={styles.textInput}
              value={fields.order}
              onChange={(e) => setField("order", e.target.value)}
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
        <button type="button" style={styles.cancelBtn} disabled={saving} onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default TransformationEdit;
