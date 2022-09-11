import { Commands, Container } from "@solar-network/cli";
import { ProcessManager } from "@solar-network/cli/dist/services";
import { Networks } from "@solar-network/crypto";
import { Utils as AppUtils } from "@solar-network/kernel";
import Joi from "joi";

import { Database } from "../database";

@Container.injectable()
export class Command extends Commands.Command {
    @Container.inject(Container.Identifiers.ProcessManager)
    private readonly processManager!: ProcessManager;

    public signature: string = "tbw:database";

    public description: string = "Edit the database.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setArgument(
                "command",
                "Delete for deleting the database, set_start to set start height.",
                Joi.string().valid("delete", "set_start").required(),
            )
            .setArgument(
                "value",
                "blocks, history or all.",
                Joi.alternatives().try(Joi.string().valid("blocks", "history", "all"), Joi.number().integer().min(0)),
            );
    }

    public async execute(): Promise<void> {
        const dbPath: string = this.app.getCorePath("data", "tbw");
        const db = new Database(dbPath);

        const command: string | undefined = this.getArgument("command");
        const value: string | number | undefined = this.getArgument("value");

        if (command === "set_start" && typeof value !== "number") {
            this.components.warning("Please specify a correct height.");
            return;
        }

        if (command !== "set_start" && typeof value !== "string") {
            this.components.warning("Please specify a correct value between blocks, history, all.");
            return;
        }

        if (command === "delete") {
            const deleteBlocks = value === undefined || value == "blocks" || value == "all";
            const deleteHistory = value === undefined || value == "history" || value == "all";
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to delete ${value || "all"} table?`,
            });

            if (confirm) {
                try {
                    if (deleteBlocks) {
                        db.deleteVotesAfterHeight(0);
                    }
                    if (deleteHistory) {
                        db.saveAndDeleteHistory();
                    }
                } catch {
                    this.components.warning("Could not delete.");
                    return;
                }

                this.components.log(`${value || "all"} table deleted`);
            }
        } else if (command === "set_start") {
            const { confirm } = await this.components.prompt({
                type: "confirm",
                name: "confirm",
                message: `Are you sure you want to set the start height to ${value}? This action will clear your tbw database and also stop core temporarily and rollback to the specified height.`,
            });

            if (confirm) {
                const isCoreRunning = this.processManager.isOnline(`${this.getFlag("token")}-core`);
                const isRelayRunning = this.processManager.isOnline(`${this.getFlag("token")}-relay`);

                const fidelity = db.getSettings()?.fidelity;
                const currentRound = AppUtils.roundCalculator.calculateRound(value as number);
                const startHeight = Math.max(0, currentRound.roundHeight - (fidelity || 0) * currentRound.maxDelegates);

                if (!isCoreRunning && !isRelayRunning) {
                    this.components.warning("Core is not running. Cannot rollback.");
                    return;
                }

                db.deleteVotesAfterHeight(0);
                await this.sendRollbackSignal(startHeight);
                db.saveAndDeleteHistory();

                this.components.log(`Start value set correctly to ${value}.`);
            }
        }
    }

    private async sendRollbackSignal(height: number): Promise<AppUtils.HttpResponse> {
        const result = await AppUtils.http.post("/rollback", {
            socketPath: this.app.getCorePath("temp", "tbw-pay.sock"),
            body: { height },
            timeout: 30000,
        });

        return result;
    }
}
