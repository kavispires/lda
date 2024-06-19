module.exports = {
  plugins: [
    {
      plugin: require("craco-less"),
      options: {
        noIeCompat: true,
      },
    },
    {
      plugin: require("craco-antd"),
      options: {
        customizeTheme: {
          "@primary-color": "#1DA57A",
        },
        lessLoaderOptions: {
          noIeCompat: true,
        },
      },
    },
  ],
};
