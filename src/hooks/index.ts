import { hookRegistry } from "./registry.js";
import { SecurityHook } from "./security.js";
import { DynamicContextHook } from "./context.js";

let _hooksRegistered = false;

export function initHooks() {
  if (!_hooksRegistered) {
    hookRegistry.register(SecurityHook);
    hookRegistry.register(DynamicContextHook);
    _hooksRegistered = true;
  }
}

export { hookRegistry };
