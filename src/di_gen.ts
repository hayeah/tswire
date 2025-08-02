import { provideProgram, provideWireTypeChecker } from "./di";
import type { Config } from "./di";
import { InjectionAnalyzer } from "./InjectionAnalyzer";

// Legacy config type for backward compatibility
interface LegacyConfig {
  rootFile: string;
}

function isLegacyConfig(cfg: any): cfg is LegacyConfig {
  return 'rootFile' in cfg && !('rootFiles' in cfg);
}

export function initAnalyzer(cfg: Config | LegacyConfig) {
  // Convert legacy config to new format
  const config: Config = isLegacyConfig(cfg) 
    ? { rootFiles: [cfg.rootFile] }
    : cfg;
    
  const program = provideProgram(config);
  const wireTypeChecker = provideWireTypeChecker(program);
  const injectionAnalyzer = new InjectionAnalyzer(config, program, wireTypeChecker);
  return injectionAnalyzer;
}