import React, { useState } from "react";
import { Box, Label, FormGroup } from "@adminjs/design-system";

// Generic file-picker edit component — works for any string URL field
// (Staff.photoUrl, Service.imageUrl). Reads the picked file as base64 in
// the browser; the actual Cloudinary upload happens server-side in the
// matching `before` hook in setupAdmin.js.
const PhotoUploadEdit = (props) => {
  const { property, record, onChange } = props;
  const currentValue = record.params[property.path];
  const [preview, setPreview] = useState(currentValue || "");

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setPreview(dataUrl);
      onChange(property.path, dataUrl);
    };
    reader.readAsDataURL(file);
  }

  return (
    <FormGroup>
      <Label>{property.label}</Label>
      {preview && (
        <Box mb="12px">
          <img
            src={preview}
            alt=""
            style={{
              maxWidth: "1600px",
              maxHeight: "1600px",
              borderRadius: "8px",
              objectFit: "cover",
              display: "block",
            }}
          />
        </Box>
      )}
      <input
        type="file"
        accept={property.props?.accept || "image/png, image/jpeg, image/webp"}
        onChange={handleFile}
      />
    </FormGroup>
  );
};

export default PhotoUploadEdit;
