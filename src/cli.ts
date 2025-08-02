#!/usr/bin/env bun

import { program } from "commander";
import { initAnalyzer } from "./di_gen";

program
  .arguments("<files...>") // This allows for multiple file arguments
  .option("-f, --foo", "use foo", false)
  .action(async (files, _options, _command) => {
    for (const file of files) {
      try {
        console.log(`tswire ${file}`);
        const analyzer = initAnalyzer({ rootFile: file });
        analyzer.writeCode();
      } catch (error) {
        console.error(`Error processing ${file}: ${error}`);
        process.exit(1);
      }
    }
  })
  .parse(process.argv);
