import { registry } from "./registry.js";
import { HelpCommand } from "./help.js";
import { IdCommand } from "./id.js";
import { NewCommand } from "./new.js";
import { ModelCommand } from "./model.js";
import { StopCommand } from "./stop.js";
import { ExportCommand } from "./export.js";
import { BashCommand } from "./bash.js";
import { SkillCommand } from "./skill.js";
import { BtwCommand } from "./btw.js";
import { CronCommand } from "./cron.js";

export function registerAllCommands() {
  registry.register(HelpCommand);
  registry.register(IdCommand);
  registry.register(NewCommand);
  registry.register(ModelCommand);
  registry.register(StopCommand);
  registry.register(ExportCommand);
  registry.register(BashCommand);
  registry.register(SkillCommand);
  registry.register(BtwCommand);
  registry.register(CronCommand);
}

export { registry };
