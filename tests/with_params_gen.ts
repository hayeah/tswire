import { provideRepo, Controller } from "./with_params";
import type { AppConfig } from "./with_params";

export function initController(cfg: AppConfig) {
  const repo = provideRepo(cfg);
  const controller = new Controller(repo);
  return controller;
}