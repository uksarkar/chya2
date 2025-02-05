import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";

export default [
  {
    input: "src/index.ts",
    output: [
      { file: "dist/index.cjs.js", format: "cjs", sourcemap: true },
      { file: "dist/index.esm.js", format: "esm", sourcemap: true },
      {
        file: "dist/index.umd.js",
        format: "umd",
        name: "chya",
        sourcemap: true
      },
      {
        file: "dist/chya.min.js",
        format: "umd",
        name: "chya",
        sourcemap: true,
        plugins: [terser()]
      }
    ],
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json"
      })
    ]
  },
  {
    input: "src/global.d.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()]
  }
];
