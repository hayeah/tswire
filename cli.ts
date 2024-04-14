#!/usr/bin/env bun

import ts from "typescript"
import { program } from "commander"
import path from "path"

// just run wire.ts...
import "./wire.ts"
import { InjectionAnalyzer, Resolver } from "./wire.ts"

program
  .arguments("<rootFile>")
  .option("-f, --foo", "use foo", false)
  .parse(process.argv)

const args = program.args
const opts = program.opts()

const rootFile = args[0]

const analyzer = new InjectionAnalyzer(rootFile)
const checker = analyzer.checker
const initializers = analyzer.findInitializers()
if (initializers.length == 0) {
  throw new Error("no initializer found")
}
const initializer = initializers[0]
const resolver = new Resolver(initializer.providers, checker)
const providers = resolver.collectProviders(initializer.providers)

const lproviders = resolver.linearizeProvidersForReturnType(
  providers,
  initializer.returnType
)

const initcode = resolver
  .generateInitFunction(
    path.basename(rootFile),
    lproviders,
    initializer.returnType
  )
  .trim()

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

const outputFile = wireOutputPath(rootFile)
await Bun.write(outputFile, initcode)
