const path = require("path");

const commonConfig = {
  entry: "./src/index.ts",
  mode: "production",
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "./dist"),
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
      },
    ],
  },
  target: "node",
};

const commonJsConfig = {
  ...commonConfig,
  output: {
    ...commonConfig.output,
    libraryTarget: "commonjs2",
    path: path.resolve(__dirname, "dist/built", "commonjs"),
  },
};

const esModuleConfig = {
  ...commonConfig,
  output: {
    ...commonConfig.output,
    libraryTarget: "module",
    chunkFormat: "module", // add this line
    path: path.resolve(__dirname, "dist/built", "esnext"),
  },
  experiments: {
    outputModule: true,
  },
};

module.exports = [commonJsConfig, esModuleConfig];
