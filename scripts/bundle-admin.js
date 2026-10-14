// Runs at image build time so containers serve a prebuilt AdminJS bundle.
process.env.NODE_ENV = "production";
delete process.env.ADMIN_JS_SKIP_BUNDLE;

const express = require("express");
const { mountAdminPanel } = require("../src/admin/setupAdmin");

mountAdminPanel(express())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
