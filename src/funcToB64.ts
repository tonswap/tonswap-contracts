
import { execSync } from "child_process"

export function compileFuncToB64(funcFiles: string[]): string {
    const out = execSync(`func -o build/tmp.fif  -SPA ${funcFiles.join(' ')}`);
    console.log(out);
    const stdOut = execSync(`fift -s build/print-hex.fif`).toString();
    return stdOut.trim();
}