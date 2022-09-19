import { Utils } from "@solar-network/crypto";

import { blocksStructType } from "../../interfaces";

export abstract class modeHandler {
    public handleFidelity(
        lastNWeights: Array<{
            height: number;
            weight: Utils.BigNumber;
        }>,
        numberOfBlocks: number,
        currentWeight: Utils.BigNumber,
    ): Utils.BigNumber {
        if (lastNWeights.length < numberOfBlocks) {
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

    protected calculateTotalRoundRewards(roundBlocks: blocksStructType[]): [Utils.BigNumber, Utils.BigNumber] {
        return roundBlocks.reduce(
            (state, curr) => {
                return [state[0].plus(curr.rewards), state[1].plus(curr.fees)];
            },
            [Utils.BigNumber.ZERO, Utils.BigNumber.ZERO],
        );
    }

    protected getBiggerHeight(blocks: blocksStructType[]) {
        return blocks.reduce((max, curr) => (curr.height > max ? curr.height : max), 0);
    }

    public abstract handleRoundBlocks(
        roundBlocks: blocksStructType[],
        min: number | null,
        max: number | null,
    ): blocksStructType[];
}
