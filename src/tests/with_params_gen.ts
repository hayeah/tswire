import { provideRepo, Controller } from "./with_params";
import type { AppConfig } from "./with_params";

export function _initController(_cfg: AppConfig) {
  const repo = provideRepo(_cfg);
  const controller = new Controller(repo);
  return controller;
}