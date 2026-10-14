module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  globalSetup: "<rootDir>/tests/globalSetup.js",
  testTimeout: 20000,
  clearMocks: true,
};
