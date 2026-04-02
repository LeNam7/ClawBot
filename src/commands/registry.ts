import type { ICommand } from "./types.js";

class CommandRegistry {
  private commands: Map<string, ICommand> = new Map();

  register(command: ICommand) {
    this.commands.set(command.name.toLowerCase(), command);
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias.toLowerCase(), command);
      }
    }
  }

  get(name: string): ICommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  getAll(): ICommand[] {
    // Unique commands (excluding aliases)
    const unique = new Set(this.commands.values());
    return Array.from(unique);
  }
}

export const registry = new CommandRegistry();
