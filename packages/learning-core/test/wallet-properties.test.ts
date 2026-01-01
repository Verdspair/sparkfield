import { MODE_BUDGETS } from '@pkg/contracts';
import { describe, expect, it } from 'vitest';
import { finalizeLearningGoldCarry, settleLearningNodeGold, type GradedLearningUnit } from '../src/index.js';

const costs=[1,2,3,4,5]; 
const fractions=[['0','1'],['1','7'],['1','3'],['1','2'],['2','3'],['5','6'],['1','1']] as const;
function scored(role:GradedLearningUnit['stepRole'],fraction:readonly [string,string]):GradedLearningUnit {
  return {stepRole:role,weight:10,quality:{numerator:fraction[0],denominator:fraction[1]}};
}

describe('integer wallet + cent charge is economically equivalent to a cent wallet',() => {
  it('exhaustively preserves every integer purchase threshold and interest tier',() => {
    for (let gold=0; gold<=80; gold++) for (let carry=0; carry<100; carry++) {
      const oldCents=BigInt(gold*100+carry);
      for (const cost of costs) expect(gold>=cost).toBe(oldCents>=BigInt(cost)*100n);
      for (const mode of ['quick','standard','deep'] as const) {
        const cap=MODE_BUDGETS.modes[mode].economy.interest_cap;
        expect(Math.min(Math.floor(gold/10),cap)).toBe(Math.min(Number(oldCents/1000n),cap));
      }
    }
  });
  it.each(['quick','standard','deep'] as const)('preserves %s balances through scored nodes, arbitrary spending, carry and terminal reset',(mode) => {
    let seed=0x7e57;
    const random=() => (seed=(Math.imul(seed,1664525)+1013904223)>>>0);
    for (let scenario=0;scenario<100;scenario++) {
      let carry=0, integerWallet=0, legacyWalletCents=0n, totalEarned=0, totalGranted=0;
      const blocks=MODE_BUDGETS.modes[mode].learning.length;
      for (let blockIndex=0;blockIndex<blocks;blockIndex++) {
        const resource=fractions[random()%fractions.length]!, verification=fractions[random()%fractions.length]!;
        const settled=settleLearningNodeGold({mode,blockIndex,carryInCents:carry,gradedUnits:[scored('resource_check',resource),scored('verification',verification)]});
        const exact=BigInt(settled.centBudget)*BigInt(settled.exactScore.numerator)/BigInt(settled.exactScore.denominator);
        expect(settled.rawEarnedCents).toBe(Number(exact));
        legacyWalletCents+=exact;
        integerWallet+=settled.grantedIntegerGold;
        carry=settled.carryOutCents;
        totalEarned+=settled.rawEarnedCents; totalGranted+=settled.grantedIntegerGold;
        expect(totalGranted*100+carry).toBe(totalEarned);
        expect(BigInt(integerWallet*100+carry)).toBe(legacyWalletCents);
        for (let attempt=0;attempt<5;attempt++) {
          const cost=costs[random()%costs.length]!;
          expect(integerWallet>=cost).toBe(legacyWalletCents>=BigInt(cost)*100n);
          if (integerWallet>=cost) {integerWallet-=cost; legacyWalletCents-=BigInt(cost)*100n;}
          expect(BigInt(integerWallet*100+carry)).toBe(legacyWalletCents);
        }
      }
      const terminal=finalizeLearningGoldCarry(carry);
      expect(terminal.carryOutCents).toBe(0);
      expect(terminal.discardedCarryCents).toBe(Number(legacyWalletCents%100n));
      expect(terminal.grantedIntegerGold).toBe(0);
      expect(totalEarned).toBeLessThanOrEqual(MODE_BUDGETS.modes[mode].learning_gold_total_max_cents);
    }
  });
});
