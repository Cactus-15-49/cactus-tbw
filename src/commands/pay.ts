import { Commands, Container } from "@solar-network/cli";
import { ProcessManager } from "@solar-network/cli/dist/services";
import { Networks } from "@solar-network/crypto";
import { Utils } from "@solar-network/kernel";
import Joi from "joi";

@Container.injectable()
export class Command extends Commands.Command {
    @Container.inject(Container.Identifiers.ProcessManager)
    private readonly processManager!: ProcessManager;

    public signature: string = "tbw:pay";

    public description: string = "Pay.";

    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)));
    }

    public async execute(): Promise<void> {
        const processesRunning =
            this.processManager.isOnline(`${this.getFlag("token")}-core`) ||
            this.processManager.isOnline(`${this.getFlag("token")}-relay`);

        if (!processesRunning) {
            this.components.error("No processes are currently running. Will not pay.");
            return;
        }

        try {
            const result = await this.sendPaySignal();
            if (result.statusCode === 200 && result.data.success) {
                this.components.log(`Done.`);
            } else {
                this.components.log(`Error: ${result.data.error || "Generic error."}. Will not pay`);
            }
        } catch (err) {
            this.components.log(`Socket error. Could not pay`);
            this.components.log(err);
        }
    }

    private async sendPaySignal(): Promise<Utils.HttpResponse> {
        const result = await Utils.http.post("/pay", {
            socketPath: this.app.getCorePath("temp", "tbw-pay.sock"),
            rejectOnError: false,
            timeout: 60000,
        });

        return result;
    }
}
