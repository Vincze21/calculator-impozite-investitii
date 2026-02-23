import type { FiscalYear, LossCarryForward } from '@/types/tax';
import { LOSS_CARRY } from '@/lib/constants';

/**
 * Aplica pierderile reportate asupra castigului net.
 * Pierderi post-2024: max 70% din castigul net, reportare 5 ani.
 * Pierderi pre-2024: fara limita 70%, reportare 7 ani.
 */
export function applyLossCarryForward(
  netGain: number,
  carriedLosses: LossCarryForward[],
  currentYear: FiscalYear
): { taxableGain: number; appliedLoss: number; remainingLosses: LossCarryForward[] } {
  if (netGain <= 0 || carriedLosses.length === 0) {
    return { taxableGain: Math.max(0, netGain), appliedLoss: 0, remainingLosses: carriedLosses };
  }

  // Sort losses: oldest first (FIFO on losses)
  const validLosses = carriedLosses
    .filter(l => l.expiresYear >= currentYear && l.amount > 0)
    .sort((a, b) => a.year - b.year);

  let remainingGain = netGain;
  let totalApplied = 0;
  const updatedLosses: LossCarryForward[] = [];

  for (const loss of validLosses) {
    if (remainingGain <= 0) {
      updatedLosses.push(loss);
      continue;
    }

    const isPost2024 = loss.year >= 2024;
    const maxCompensation = isPost2024
      ? netGain * LOSS_CARRY.post2024.maxCompensationRate // max 70% of original net gain
      : Infinity; // no limit for pre-2024

    const alreadyAppliedPost2024 = totalApplied; // track for 70% limit
    const availableForThisLoss = isPost2024
      ? Math.max(0, maxCompensation - alreadyAppliedPost2024)
      : Infinity;

    const applied = Math.min(loss.amount, remainingGain, availableForThisLoss);
    remainingGain -= applied;
    totalApplied += applied;

    if (loss.amount - applied > 0.01) {
      updatedLosses.push({
        ...loss,
        amount: loss.amount - applied,
      });
    }
  }

  return {
    taxableGain: Math.max(0, remainingGain),
    appliedLoss: totalApplied,
    remainingLosses: updatedLosses,
  };
}

/**
 * Creeaza o noua pierdere pentru reportare.
 */
export function createLossCarryForward(
  netLoss: number,
  lossYear: number
): LossCarryForward {
  const isPost2024 = lossYear >= 2024;
  return {
    year: lossYear,
    amount: Math.abs(netLoss),
    expiresYear: lossYear + (isPost2024 ? LOSS_CARRY.post2024.years : LOSS_CARRY.pre2024.years),
    maxCompensation: isPost2024 ? LOSS_CARRY.post2024.maxCompensationRate : null,
  };
}
