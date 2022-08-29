import { Utils } from "@solar-network/crypto";

import { blockRewardType } from "../../interfaces";

export abstract class modeHandler {
    public handleFidelity(
        lastNWeights: Array<{
            height: number;
            weight: Utils.BigNumber;
        }>,
        fidelity: number,
        currentWeight: Utils.BigNumber,
    ): Utils.BigNumber {
        if (lastNWeights.length < fidelity) {
            return Utils.BigNumber.ZERO;
        }
        const fidelityBalance = lastNWeights.reduce(
            (prev, current) => (prev.isLessThan(current.weight) ? prev : current.weight),
            currentWeight,
        );
        if (currentWeight.isGreaterThan(fidelityBalance)) {
            return fidelityBalance;
        }
        return currentWeight;
    }

    protected calculateTotalRoundRewards(roundBlocks: blockRewardType[]): [Utils.BigNumber, Utils.BigNumber] {
        return roundBlocks
            .filter(
                (value, index, self) =>
                    value.rewards.isGreaterThan(0) && self.findIndex((b) => b.height === value.height) === index,
            )
            .reduce(
                (state, curr) => {
                    return [state[0].plus(curr.rewards), state[1].plus(curr.fees)];
                },
                [Utils.BigNumber.ZERO, Utils.BigNumber.ZERO],
            );
    }

    protected getBiggerHeight(blocks: blockRewardType[]) {
        return blocks.reduce((max, curr) => (curr.height > max ? curr.height : max), 0);
    }

    public abstract handleRoundBlocks(
        roundBlocks: blockRewardType[],
        min: number | null,
        max: number | null,
    ): blockRewardType[];
}
