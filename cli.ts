#!/usr/bin/env bun

import { program } from "commander"
import path from "path"

import { InjectionAnalyzer } from "./wire.ts"

// `wireOutputPath` generates a new file path with `_wire` appended to the
// filename before the extension, using Node.js `path` module for handling file
// paths. This approach is more robust and handles edge cases well, such as
// files without extensions. `inputFilePath`: A string representing the path to
// the input file. Returns a string representing the path to the output file
// with `_wire` appended to the filename.
function wireOutputPath(inputFilePath: string): string {
  // Extract the directory, filename without extension, and extension from the input path.
  const dirname = path.dirname(inputFilePath)
  const extname = path.extname(inputFilePath)
  const basename = path.basename(inputFilePath, extname)

  // Append '_gen' to the basename, then reconstruct the path.
  const outputFileName = `${basename}_gen${extname}`
  const outputFilePath = path.join(dirname, outputFileName)

  return outputFilePath
}

program
  .arguments("<rootFile>")
  .option("-f, --foo", "use foo", false)
  .action(async (rootFile, options, command) => {
    try {
      const analyzer = new InjectionAnalyzer(rootFile)

      const initializers = analyzer.findInitializers()
      if (initializers.length != 1) {
        throw new Error("expects exactly 1 initializer")
      }

      const init = initializers[0]
      const initCode = await init.initializationCode()

      const outputFile = wireOutputPath(rootFile)
      await Bun.write(outputFile, initCode)
    } catch (error) {
      console.error(`Error: ${error}`)
      process.exit(1)
    }
  })
  .parse(process.argv)
