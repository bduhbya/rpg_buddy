module.exports = {
  entry: './src/main/main.ts',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-typescript',
              ['@babel/preset-react', { runtime: 'automatic', development: false }],
            ],
          },
        },
      },
    ],
  },
  resolve: { extensions: ['.ts', '.tsx', '.js'] },
};
