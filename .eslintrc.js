module.exports = {
  extends: ["@raycast/eslint-config"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    }
  },
  env: {
    node: true,
    es2022: true
  }
};
