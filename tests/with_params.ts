import { tswire } from ".."

export interface AppConfig {
  apiUrl: string
  debug: boolean
}

interface Repo {
  config: AppConfig
}

export function provideRepo(config: AppConfig): Repo {
  return { config }
}

export class Controller {
  constructor(public repo: Repo) {}
}

function initController(cfg: AppConfig): Controller {
  tswire([provideRepo, Controller])
  return null as any
}