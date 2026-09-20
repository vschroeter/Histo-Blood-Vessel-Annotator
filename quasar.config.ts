import { defineConfig } from '#q-app/wrappers';

export default defineConfig(() => {
  return {
    boot: [],
    css: ['app.scss'],
    extras: ['roboto-font', 'material-icons'],

    build: {
      target: {
        browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
        node: 'node20',
      },
      typescript: {
        strict: true,
        vueShim: true,
      },
      rollupOptions: {
        external: ['sharp'],
      },
      vueRouterMode: 'hash',
      vitePlugins: [
        [
          'vite-plugin-checker',
          {
            vueTsc: true,
            eslint: {
              lintCommand: 'eslint -c ./eslint.config.js "./src*/**/*.{ts,js,mjs,cjs,vue}"',
              useFlatConfig: true,
            },
          },
          { server: false },
        ],
      ],
    },

    devServer: {
      open: false,
    },

    framework: {
      config: {},
      plugins: [],
    },

    animations: [],

    electron: {
      preloadScripts: ['electron-preload'],
      inspectPort: 5858,
      bundler: 'builder',
      builder: {
        appId: 'image-annotator',
        productName: 'Image Annotator',
        asar: true,
        asarUnpack: [
          '**/node_modules/sharp/**/*',
          '**/node_modules/@img/**/*',
        ],
        win: {
          target: [
            { target: 'nsis', arch: ['x64'] },
            { target: 'portable', arch: ['x64'] },
          ],
        },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          artifactName: '${productName}-Setup-${version}.${ext}',
        },
        portable: {
          artifactName: '${productName}-Portable-${version}.${ext}',
        },
        mac: {
          target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
          artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
        },
        linux: {
          target: [{ target: 'AppImage', arch: ['x64'] }],
          artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
        },
      },
    },
  };
});
