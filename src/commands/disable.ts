import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import { readFileSync, writeFileSync } from "fs";
import Joi from "joi";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:disable";

    public description: string = "Disable tbw.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token.", Joi.string().default("ark"))
            .setFlag("network", "The name of the network.", Joi.string().valid(...Object.keys(Networks)));
    }

    public async execute(): Promise<void> {
        const packageName = require(__dirname + "/../../package.json").name;

        const appJsonFile = this.app.getCorePath("config", "app.json");
        const appJson = JSON.parse(readFileSync(appJsonFile).toString());

        appJson.core.plugins = appJson.core.plugins.filter((plugin) => plugin.package !== packageName);
        appJson.relay.plugins = appJson.relay.plugins.filter((plugin) => plugin.package !== packageName);

        writeFileSync(appJsonFile, JSON.stringify(appJson, null, 4));

        this.components.log("TBW disabled successfully. Please restart core.");
    }
}
