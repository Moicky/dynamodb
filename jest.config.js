const testDir = "<rootDir>/test";

module.exports = {
  testMatch: [`${testDir}/**/*.js`],
  testPathIgnorePatterns: [
    `${testDir}/helpers.js`,
    `${testDir}/setup/init.js`,
    `${testDir}/setup/setup-each.js`,
  ],
  globalSetup: `${testDir}/setup/init.js`,
  setupFilesAfterEnv: [`${testDir}/setup/setup-each.js`],
  testTimeout: 30000,
};
