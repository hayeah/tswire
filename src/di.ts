export interface Config {
  rootFiles: string[];
}

import * as ts from "typescript";
import type { WireTypeChecker } from "./types";
import { monkeyPatchTypeChecker } from "./utils";

let cachedProgram: ts.Program | undefined;
let cachedChecker: WireTypeChecker | undefined;

export function provideProgram(c: Config): ts.Program {
  const currentRootNames = new Set(cachedProgram?.getRootFileNames() ?? []);

  // Check if all new root names are already in the current program
  const needsRebuild = c.rootFiles.some((file) => !currentRootNames.has(file));

  if (cachedProgram && !needsRebuild) {
    return cachedProgram;
  }

  const rootNames = new Set([
    ...(cachedProgram?.getRootFileNames() ?? []),
    ...c.rootFiles,
  ]);

  cachedProgram = ts.createProgram({
    rootNames: [...rootNames],
    options: { allowJs: true, incremental: true },
    oldProgram: cachedProgram,
  });

  cachedChecker = undefined; // force rebuild on next call
  return cachedProgram;
}

export function provideWireTypeChecker(p: ts.Program): WireTypeChecker {
  if (cachedChecker && p === cachedProgram) return cachedChecker;
  cachedChecker = monkeyPatchTypeChecker(p.getTypeChecker());
  return cachedChecker;
}

import { InjectionAnalyzer } from "./InjectionAnalyzer";
import { tswire } from "./index";

export function initAnalyzer(_cfg: Config): InjectionAnalyzer {
  tswire([provideProgram, provideWireTypeChecker, InjectionAnalyzer]);
  return null as any;
}
