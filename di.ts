export interface Config {
  rootFile: string;
}

import * as ts from "typescript";
import type { WireTypeChecker } from "./types";
import { monkeyPatchTypeChecker } from "./utils";

export function provideProgram(c: Config): ts.Program {
  return ts.createProgram([c.rootFile], { allowJs: true });
}

export function provideWireTypeChecker(p: ts.Program): WireTypeChecker {
  return monkeyPatchTypeChecker(p.getTypeChecker());
}

import { InjectionAnalyzer } from "./InjectionAnalyzer";
import { tswire } from "./index";

export function initAnalyzer(cfg: Config): InjectionAnalyzer {
  tswire([provideProgram, provideWireTypeChecker, InjectionAnalyzer]);
  return null as any;
}
