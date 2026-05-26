import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const nodeVersion = process.versions.node;
const nodeMajor = Number(nodeVersion.split(".")[0]);
const npmUserAgent = process.env.npm_config_user_agent ?? "unavailable";
const pbivizVersion = readPackageVersion("powerbi-visuals-tools/package.json");

console.log(JSON.stringify({
    node: nodeVersion,
    nodeMajorSupported: nodeMajor === 20,
    npmUserAgent,
    pbivizVersion
}, null, 2));

function readPackageVersion(packagePath) {
    try {
        const packageJson = require(packagePath);
        return packageJson.version ?? "unknown";
    } catch (error) {
        return `unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
}
