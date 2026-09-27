export default {
  plugins: {
    'postcss-preset-env': {
      stage: 0,
      features: {
        'color-function': true,
        'relative-color-syntax': true,
      },
      preserve: false,
    },
    autoprefixer: {},
  },
};
