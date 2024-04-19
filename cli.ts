#!/usr/bin/env bun

import { program } from "commander"
import path from "path"

import { InjectionAnalyzer } from "./wire.ts"

program
  .arguments("<rootFile>")
  .option("-f, --foo", "use foo", false)
  .action(async (rootFile, options, command) => {
    try {
      const analyzer = new InjectionAnalyzer(rootFile)
      analyzer.writeCode()
    } catch (error) {
      console.error(`Error: ${error}`)
      process.exit(1)
    }
  })
  .parse(process.argv)
