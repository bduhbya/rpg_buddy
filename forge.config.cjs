module.exports = {
  packagerConfig: { asar: true, executableName: 'RPG Buddy' },
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        port: 5173,
        mainConfig: './webpack.main.config.cjs',
        // Electron 45 sandbox preloads cannot run the dev client's Node shims.
        devServer: { host: '127.0.0.1', client: false, hot: false, liveReload: false },
        devContentSecurityPolicy:
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:5173",
        renderer: {
          config: './webpack.renderer.config.cjs',
          nodeIntegration: false,
          entryPoints: [
            {
              name: 'main_window',
              html: './index.html',
              js: './src/renderer/main.tsx',
              preload: { js: './src/preload/preload.ts' },
            },
          ],
        },
      },
    },
  ],
};
