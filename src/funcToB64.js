const { execSync } = require("child_process");

function compileFuncToB64(funcFiles) {
    const out = execSync(`func -o build/tmp.fif  -SPA ${funcFiles.join(" ")}`);
    //  console.log(out);
    const stdOut = execSync(`fift -s build/print-hex.fif`).toString();
    return stdOut.trim();
}

module.exports = {
    compileFuncToB64
}
