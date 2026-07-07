const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace roots
const projectRoot = __dirname;
// This points to the parent directory where Vite web src lives
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Let Metro watch the parent root directory for code sharing
config.watchFolders = [workspaceRoot];

// 2. Add 'mjs' to sourceExts for resolving lucide-react-native icon files
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

// 3. Force Metro to resolve modules inside the local node_modules first, then the parent workspace
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 4. Custom resolver request handler to force single copy of react/react-native
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const redirectPackages = ['react', 'react-native', 'react-native-url-polyfill'];
  if (redirectPackages.includes(moduleName)) {
    return context.resolveRequest(
      context,
      path.resolve(projectRoot, 'node_modules', moduleName),
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
