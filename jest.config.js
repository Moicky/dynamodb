module.exports = {
  testMatch: ["<rootDir>/test/**/*.js"],
  testPathIgnorePatterns: [
    "<rootDir>/test/helpers.js",
    "<rootDir>/test/jest.setup.js",
  ],
  globalSetup: "<rootDir>/test/jest.setup.js",
  testTimeout: 30000,
};
