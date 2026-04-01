import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Checks if the local Docker daemon is running and accessible.
 */
export async function isDockerReady(): Promise<boolean> {
  try {
    await execAsync("docker info", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs a command inside a Docker sandbox container.
 * Uses an ephemeral `node:22-alpine` container, mounting the `workspaceDir` (if provided).
 */
export async function runInSandbox(
  command: string,
  workspaceDir: string | undefined,
  timeoutMs: number
): Promise<string> {
  // Ensure the command is wrapped so it works correctly in mostly any unix shell
  // We double quote or properly escape the user command. Using a script might be safer, 
  // but sh -c "..." is standard. Since command might have quotes, we will encode it in base64 
  // and decode it inside to prevent quote escaping hell.
  
  const b64Command = Buffer.from(command).toString("base64");
  
  let dockerArgs = [
    "run", "--rm",
    "-i",                   // Keep STDIN open even if not attached
    "--net=bridge",         // Basic networking
  ];

  if (workspaceDir) {
    // Mount the host workspace into /workspace
    dockerArgs.push("-v", `"${workspaceDir}:/workspace"`);
    dockerArgs.push("-w", "/workspace");
  }

  // Use node:22-alpine as a fast, javascript-ready environment
  dockerArgs.push("node:22-alpine");
  
  // Decoding and executing inside container: echo BASE64 | base64 -d | sh
  dockerArgs.push("sh", "-c", `echo ${b64Command} | base64 -d | sh`);

  const fullDockerCommand = `docker ${dockerArgs.join(" ")}`;

  try {
    const { stdout, stderr } = await execAsync(fullDockerCommand, {
      timeout: timeoutMs,
      // Pass empty env to ensure clean execution and no host leak (Docker itself will manage this)
    });
    
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    return output || "(no output)";
  } catch (err: unknown) {
    if (err && typeof err === "object") {
      const e = err as { killed?: boolean; stdout?: string; stderr?: string; message?: string; code?: number };
      if (e.killed) return `⏱ Sandbox execution timed out after ${timeoutMs / 1000}s`;
      const out = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
      return out || e.message || `Sandbox command failed with code ${e.code}`;
    }
    return String(err);
  }
}
