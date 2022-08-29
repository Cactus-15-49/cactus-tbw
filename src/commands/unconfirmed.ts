import { Commands, Container } from "@solar-network/cli";
import { ProcessManager } from "@solar-network/cli/dist/services";
import { Networks } from "@solar-network/crypto";
import { Utils } from "@solar-network/kernel";
import Joi from "joi";

import { Database } from "../database";
import { validId } from "../utils/validation";

@Container.injectable()
export class Command extends Commands.Command {
    @Container.inject(Container.Identifiers.ProcessManager)
    private readonly processManager!: ProcessManager;

    public signature: string = "tbw:unconfirmed";

    public description: string = "Handle unconfirmed or errored transactions.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument("command", "Replay or show.", Joi.string().valid("replay, show"))
            .setArgument("value", "Transaction Id to be replayed.", validId);
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);

        const processesRunning =
            this.processManager.isOnline(`${this.getFlag("token")}-core`) ||
            this.processManager.isOnline(`${this.getFlag("token")}-relay`);

        const command: string | undefined = this.getArgument("command");
        const value: string | undefined = this.getArgument("value");

        if ((command === "replay" || command === "show") && !value) {
            this.components.warning(`Please specify the id to the transaction to ${command}.`);
            return;
        }

        switch (command) {
            case "replay": {
                if (!processesRunning) {
                    this.components.error("No processes are currently running. Will not replay.");
                    return;
                }
                const unconfirmed = db.getNotConfirmedTransactions();
                const tx = unconfirmed.find((u) => u.id === value);
                if (!tx) {
                    this.components.error(`No unconfirmed transaction with this id.`);
                    return;
                }
                console.log("TRANSACTION:");
                console.log(`- Id: ${tx.id}`);
                console.log(`- Height: ${tx.height}`);
                console.log(`- Timestamp: ${tx.timestamp}`);
                console.log(`- Status: ${tx.status}`);
                console.log(`- Total Amount: ${tx.totalAmount}`);
                console.log(`- Addresses: ${tx.addresses}`);
                console.log(`- Raw transaction: ${JSON.stringify(JSON.parse(tx.tx), null, 4)}`);

                const { confirm } = await this.components.prompt({
                    type: "confirm",
                    name: "confirm",
                    message: `Do you confirm you want to resend this transaction? MAKE SURE THIS TRANSACTION WAS ACTUALLY NOT SENT AND THAT THE INFORMATION CONTAINED IS CORRECT`,
                });

                if (confirm) {
                    try {
                        const result = await this.sendRepay(tx.id);
                        if (result.statusCode === 200 && result.data.success) {
                            this.components.log(`Transaction resent. Check your node logs for errors.`);
                        } else {
                            this.components.warning(result.data.error || "Generic error.");
                        }
                    } catch {
                        this.components.log(`Socket error. Will not repay`);
                    }
                }
                break;
            }
            case "show": {
                const unconfirmed = db.getNotConfirmedTransactions();
                const tx = unconfirmed.find((u) => u.id === value);
                if (!tx) {
                    this.components.warning(`No unconfirmed transaction with this id.`);
                    return;
                }

                console.log("TRANSACTION:");
                console.log(`- Id: ${tx.id}`);
                console.log(`- Height: ${tx.height}`);
                console.log(`- Timestamp: ${tx.timestamp}`);
                console.log(`- Status: ${tx.status}`);
                console.log(`- Total Amount: ${tx.totalAmount}`);
                console.log(`- Addresses: ${tx.addresses}`);
                console.log(`- Raw transaction: ${JSON.stringify(JSON.parse(tx.tx), null, 4)}`);
                break;
            }
            default: {
                const unconfirmed = db.getNotConfirmedTransactions();

                const errored = unconfirmed.filter((u) => u.status === "ERROR");
                const pending = unconfirmed.filter((u) => u.status === "PENDING");
                const accepted = unconfirmed.filter((u) => u.status === "ACCEPTED");

                if (errored.length === 0 && pending.length === 0 && accepted.length === 0) {
                    console.log("No unconfirmed transaction");
                }

                if (errored.length > 0) {
                    this.components.log(`ERRORED:`);
                    this.components.table(["height", "timestamp", "amount", "status"], (table) => {
                        for (const tx of errored) {
                            table.push([tx.height, tx.timestamp, tx.totalAmount, tx.status]);
                        }
                    });
                }
                if (pending.length > 0) {
                    this.components.log(`PENDING:`);
                    this.components.table(["height", "timestamp", "amount", "status"], (table) => {
                        for (const tx of pending) {
                            table.push([tx.height, tx.timestamp, tx.totalAmount, tx.status]);
                        }
                    });
                }
                if (accepted.length > 0) {
                    this.components.log(`ACCEPTED BUT NOT FORGED:`);
                    this.components.table(["height", "timestamp", "amount", "status"], (table) => {
                        for (const tx of accepted) {
                            table.push([tx.height, tx.timestamp, tx.totalAmount, tx.status]);
                        }
                    });
                }
            }
        }
    }

    private async sendRepay(id: string): Promise<Utils.HttpResponse> {
        const result = await Utils.http.post("/repay", {
            socketPath: this.app.getCorePath("temp", "tbw-pay.sock"),
            body: { id },
        });

        return result;
    }
}
