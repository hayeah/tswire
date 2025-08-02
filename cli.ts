#!/usr/bin/env bun

import { program } from "commander";
import { InjectionAnalyzer } from "./wire.ts";

program
  .arguments("<files...>") // This allows for multiple file arguments
  .option("-f, --foo", "use foo", false)
  .action(async (files, _options, _command) => {
    for (const file of files) {
      try {
        console.log(`tswire ${file}`);
        const analyzer = new InjectionAnalyzer(file);
        analyzer.writeCode();
      } catch (error) {
        console.error(`Error processing ${file}: ${error}`);
        process.exit(1);
      }
    }
  })
  .parse(process.argv);
