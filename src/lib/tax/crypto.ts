import { CRYPTO_EXEMPT } from '@/lib/constants';

export interface CryptoTransaction {
  gainRON: number;
}

/**
 * Verifica daca castigurile crypto sunt sub pragul neimpozabil.
 * Prag: castig < 200 lei/tranzactie SI total < 600 lei/an => SCUTIT
 */
export function isCryptoExempt(
  transactions: CryptoTransaction[]
): { exempt: boolean; reason: string } {
  const totalGain = transactions.reduce((sum, tx) => sum + Math.max(0, tx.gainRON), 0);
  const allUnder200 = transactions.every(tx => tx.gainRON < CRYPTO_EXEMPT.perTransaction);

  if (allUnder200 && totalGain < CRYPTO_EXEMPT.annualTotal) {
    return {
      exempt: true,
      reason: `Castiguri crypto sub pragul neimpozabil (${totalGain.toFixed(0)} lei < ${CRYPTO_EXEMPT.annualTotal} lei/an, toate sub ${CRYPTO_EXEMPT.perTransaction} lei/tranzactie)`,
    };
  }

  return {
    exempt: false,
    reason: totalGain >= CRYPTO_EXEMPT.annualTotal
      ? `Total castiguri crypto (${totalGain.toFixed(0)} lei) depaseste pragul de ${CRYPTO_EXEMPT.annualTotal} lei/an`
      : `Cel putin o tranzactie crypto depaseste ${CRYPTO_EXEMPT.perTransaction} lei`,
  };
}
