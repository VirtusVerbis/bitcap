import fs from "fs";
import { load as yamlLoad } from "js-yaml";

const yamlPath = "config/hosts.yaml";
const jsonPath = "config/hosts.json";

const data = yamlLoad(fs.readFileSync(yamlPath, "utf8"));
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");
console.log(`Wrote ${jsonPath}`);