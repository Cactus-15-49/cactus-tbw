import { Utils } from "@solar-network/crypto";

import { blockRewardType } from "../../interfaces";
import { modeHandler } from "./handler";

export class lastMode extends modeHandler {
    public handleRoundBlocks(roundBlocks: blockRewardType[], min: number | null, max: number | null) {
        const blocks = roundBlocks.filter(
            (value, index, self) => self.findIndex((b) => b.height === value.height) === index,
        );
        if (blocks.length < 53) {
            return [];
        }
        const [totalRewards, totalFees] = this.calculateTotalRoundRewards(roundBlocks);
        if (totalRewards.isGreaterThan(0)) {
            const biggerHeight = this.getBiggerHeight(roundBlocks);

            return roundBlocks
                .filter((b) => b.height === biggerHeight && b.weight.isGreaterThan(min ? min * 1e8 : 0))
                .map((b) => {
                    if (max && b.weight.isGreaterThan(max * 1e8)) {
                        b.weight = Utils.BigNumber.make(max * 1e8);
                    }
                    return {
                        height: b.height,
                        weight: b.weight,
                        address: b.address,
                        rewards: totalRewards,
                        fees: totalFees,
                    };
                });
        }
        return [];
    }
}
