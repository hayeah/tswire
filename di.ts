export interface Config {
  rootFile: string;
}

import * as ts from "typescript";
import type { WireTypeChecker } from "./types";
import { monkeyPatchTypeChecker } from "./utils";

let cachedProgram: ts.Program | undefined;
let cachedChecker: WireTypeChecker | undefined;

export function provideProgram(c: Config): ts.Program {
  if (cachedProgram?.getRootFileNames().includes(c.rootFile)) {
    return cachedProgram;
  }

  const rootNames = new Set([
    ...(cachedProgram?.getRootFileNames() ?? []),
    c.rootFile,
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

export function initAnalyzer(cfg: Config): InjectionAnalyzer {
  tswire([provideProgram, provideWireTypeChecker, InjectionAnalyzer]);
  return null as any;
}
