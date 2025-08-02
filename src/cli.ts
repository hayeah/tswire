#!/usr/bin/env bun

import { program } from "commander";
import { initAnalyzer } from "./di_gen";

program
  .arguments("<files...>") // This allows for multiple file arguments
  .option("-f, --foo", "use foo", false)
  .action(async (files, _options, _command) => {
    console.time("Total processing time");

    try {
      // Create single analyzer for all files
      const analyzer = initAnalyzer({ rootFiles: files });

      // Write code for each file
      for (const file of files) {
        console.log(`tswire ${file}`);
        await analyzer.writeCode(file);
      }
    } catch (error) {
      console.error(`Error processing files: ${error}`);
      process.exit(1);
    }

    console.timeEnd("Total processing time");
  })
  .parse(process.argv);
