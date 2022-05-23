import { execSync } from "child_process";

export function compileFuncToB64(funcFiles: string[]): string {
    const out = execSync(`/usr/local/bin/func -o build/tmp.fif  -SPA ${funcFiles.join(" ")}`);
    //  console.log(out);
    const stdOut = execSync(`fift -s utils/print-hex.fif`).toString();
    return stdOut.trim();
}
