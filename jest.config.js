module.exports = {
  testMatch: ["<rootDir>/test/**/*.js"],
  testPathIgnorePatterns: [
    "<rootDir>/test/helpers.js",
    "<rootDir>/test/jest.setup.js",
    "<rootDir>/test/jest.setup-each.js",
  ],
  globalSetup: "<rootDir>/test/jest.setup.js",
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup-each.js"],
  testTimeout: 30000,
};
