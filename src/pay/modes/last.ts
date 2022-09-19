import { Utils } from "@solar-network/crypto";

import { blocksStructType } from "../../interfaces";
import { modeHandler } from "./handler";

export class lastMode extends modeHandler {
    public handleRoundBlocks(roundBlocks: blocksStructType[], min: number | null, max: number | null) {
        const [totalRewards, totalFees] = this.calculateTotalRoundRewards(roundBlocks);
        if (totalRewards.isGreaterThan(0)) {
            const biggerHeight = this.getBiggerHeight(roundBlocks);

            const block = roundBlocks.find((b) => b.height === biggerHeight);

            return [
                {
                    height: block!.height,
                    round: block!.round,
                    rewards: totalRewards,
                    fees: totalFees,
                    balances: block!.balances
                        .filter((b) => b.weight.isGreaterThan(min ? min * 1e8 : 0))
                        .map((b) => {
                            if (max && b.weight.isGreaterThan(max * 1e8)) {
                                b.weight = Utils.BigNumber.make(max * 1e8);
                            }
                            return b;
                        }),
                },
            ];
        }
        return [];
    }
}
