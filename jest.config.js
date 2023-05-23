module.exports = {
  testMatch: ["<rootDir>/test/**/*.js"],
  testPathIgnorePatterns: [
    "<rootDir>/test/helpers.js",
    "<rootDir>/test/jest.setup.js",
  ],
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.js"],
};
