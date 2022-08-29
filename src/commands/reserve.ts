import { Commands, Container } from "@solar-network/cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

import { Database } from "../database";
import { addressToPercentageObjects, validate } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    public signature: string = "tbw:reserve";

    public description: string = "Get or update the reserve.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("command", "set for setting a new reserve, empty to show.", Joi.string().valid("set"))
            .setArgument("value", "New reserve object in format addr1:10,addr2:90", Joi.string().min(0));
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);
        const settings = db.getSettings();
        if (!settings) {
            this.components.warning("Please configure tbw before using any other command.");
            return;
        }

        const command: string | undefined = this.getArgument("command");
        const value: string | undefined = this.getArgument("value");

        if (command && value === undefined) {
            this.components.warning(`Please specify the new reserve option. Format: addr1:20,addr2:80`);
            return;
        }

        switch (command) {
            case "set": {
                const reserve: { [key: string]: number } = {};
                if (value !== "") {
                    const reserveArray = value!.split(",").map((v) => v.split(":"));
                    if (reserveArray.some((a) => a.length !== 2)) {
                        this.components.warning("Wrong format for reserve");
                        return;
                    }
                    for (const [address, percentage] of reserveArray) {
                        if (address.length !== 34) {
                            this.components.warning("Addresses must be 34 char long");
                            return;
                        }
                        const validatedPercentage = parseInt(percentage);
                        if (isNaN(validatedPercentage) || validatedPercentage < 0 || validatedPercentage > 100) {
                            this.components.warning("Number must be a percentage");
                            return;
                        }
                        reserve[address] = (reserve[address] || 0) + validatedPercentage;
                    }

                    if (![0, 100].includes(Object.values(reserve).reduce((p, c) => p + c, 0))) {
                        this.components.warning("Total is not 100% or 0%");
                        return;
                    }
                }
                const validated = validate(addressToPercentageObjects, reserve);
                if (validated) {
                    this.components.warning("Error in the reserve format.");
                    return;
                }
                const { confirm } = await this.components.prompt({
                    type: "confirm",
                    name: "confirm",
                    message: `Are you sure you want to add ${JSON.stringify(value, null, 4)} as reserve?`,
                });

                if (confirm) {
                    try {
                        db.updateReserve(reserve);
                    } catch {
                        this.components.warning("Could not save settings. Reserve unchanged.");
                        return;
                    }

                    this.components.log(`Reserve updated.`);
                }
                break;
            }
            default: {
                if (Object.keys(settings.reserve).length) {
                    this.components.log(`Reserve:`);
                    for (const address in settings.reserve) {
                        this.components.log(`- ${address}: ${settings.reserve[address]}%`);
                    }
                } else {
                    this.components.log(`No reserve set.`);
                }
            }
        }
    }
}
