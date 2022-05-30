import { execSync } from "child_process";

export function compileFuncToB64(funcFiles: string[]): string {
    const funcPath = process.env.FUNC_PATH || "func";
    try {
        execSync(`${funcPath} -o build/tmp.fif  -SPA ${funcFiles.join(" ")}`);
    } catch (e: any) {
        if (e.message.indexOf("error: `#include` is not a type identifier") > -1) {
            console.log(`
===============================================================================
Please update your func compiler to support the latest func features
to set custom path to your func compiler please set  the env variable "export FUNC_PATH=/usr/local/bin/func" 
===============================================================================
`);
            process.exit(1);
        } else {
            console.log(e.message);
        }
    }

    const stdOut = execSync(`fift -s utils/print-hex.fif`).toString();
    return stdOut.trim();
}
