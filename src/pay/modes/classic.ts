import { Utils } from "@solar-network/crypto";

import { blocksStructType } from "../../interfaces";
import { modeHandler } from "./handler";

export class classicMode extends modeHandler {
    public handleRoundBlocks(roundBlocks: blocksStructType[], min: number | null, max: number | null) {
        const blocks = roundBlocks.filter((b) => b.rewards.isGreaterThan(0));
        return blocks.map((b) => {
            return {
                ...b,
                balances: b.balances
                    .filter((b) => b.weight.isGreaterThan(min ? min * 1e8 : 0))
                    .map((b) => {
                        if (max && b.weight.isGreaterThan(max * 1e8)) {
                            b.weight = Utils.BigNumber.make(max * 1e8);
                        }
                        return b;
                    }),
            };
        });
    }
}
