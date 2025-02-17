import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import fs from "fs";
import path from "path";

const dtsGenerator = options => {
  const { distFolder = "dist", fileName = "index.d.ts" } = options;

  return {
    name: "dts-generator",
    writeBundle() {
      const outputDir = path.resolve(distFolder);
      const filePath = path.join(outputDir, fileName);

      // Delete existing d.ts file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Create the directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write the custom d.ts content
      const content = `import Chya from "./chya";\ndeclare global {\n  var Chya: Chya;\n}`;
      fs.writeFileSync(filePath, content);
    }
  };
};

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
      }),
      dtsGenerator()
    ]
  }
];
