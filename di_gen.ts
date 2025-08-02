import { provideProgram, provideWireTypeChecker } from "./di";
import type { Config } from "./di";
import { InjectionAnalyzer } from "./InjectionAnalyzer";

export function initAnalyzer(cfg: Config) {
  const program = provideProgram(cfg);
  const wireTypeChecker = provideWireTypeChecker(program);
  const injectionAnalyzer = new InjectionAnalyzer(cfg, program, wireTypeChecker);
  return injectionAnalyzer;
}