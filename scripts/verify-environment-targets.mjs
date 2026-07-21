import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED = {
  gitRemote: "https://github.com/cdf-ops/cdf.git",
  supabaseProjectRef: "konecfaiwwarbjejpswo",
  supabaseUrl: "https://konecfaiwwarbjejpswo.supabase.co",
  vercelOrgId: "team_quBlbncEu7nxAV5KGowycQ4q",
  vercelProjectId: "prj_yQwYHAtrAHOcJNzA0YX2hJuxktOi",
};

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exitCode = 1;
}

function readRequiredFile(path, label) {
  if (!existsSync(path)) {
    fail(`${label} não encontrado em ${path}.`);
    return null;
  }
  return readFileSync(path, "utf8").trim();
}

const projectRoot = process.cwd();

try {
  const gitRemote = execFileSync("git", ["remote", "get-url", "origin"], {
    cwd: projectRoot,
    encoding: "utf8",
  }).trim();
  if (gitRemote !== EXPECTED.gitRemote) {
    fail(`origin inesperado: ${gitRemote}`);
  }
} catch {
  fail("não foi possível validar o remote origin do GitHub.");
}

const supabaseRef = readRequiredFile(
  resolve(projectRoot, "supabase/.temp/project-ref"),
  "Vínculo local do Supabase"
);
if (supabaseRef && supabaseRef !== EXPECTED.supabaseProjectRef) {
  fail(`Supabase inesperado: ${supabaseRef}`);
}

const vercelProjectJson = readRequiredFile(
  resolve(projectRoot, ".vercel/project.json"),
  "Vínculo local da Vercel"
);
if (vercelProjectJson) {
  try {
    const vercelProject = JSON.parse(vercelProjectJson);
    if (
      vercelProject.orgId !== EXPECTED.vercelOrgId ||
      vercelProject.projectId !== EXPECTED.vercelProjectId
    ) {
      fail(`Vercel inesperada: ${vercelProject.orgId ?? "sem org"}/${vercelProject.projectId ?? "sem projeto"}`);
    }
  } catch {
    fail("o vínculo local da Vercel não contém JSON válido.");
  }
}

const envLocalPath = resolve(projectRoot, ".env.local");
if (existsSync(envLocalPath)) {
  const envLocal = readFileSync(envLocalPath, "utf8");
  const supabaseUrl = envLocal.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  if (supabaseUrl !== EXPECTED.supabaseUrl) {
    fail(`NEXT_PUBLIC_SUPABASE_URL inesperada: ${supabaseUrl ?? "ausente"}`);
  }
}

if (!process.exitCode) {
  console.log("Ambiente confirmado: Clube do Frio (GitHub, Supabase e Vercel).");
}
