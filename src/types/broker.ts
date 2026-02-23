export type BrokerType = 'resident' | 'nonresident';

export type BrokerName =
  | 'tradeville'
  | 'goldring'
  | 'xtb_ro'
  | 'bt_capital'
  | 'swiss_capital'
  | 'ibkr'
  | 'trading212'
  | 'etoro'
  | 'revolut'
  | 'xtb'
  | 'avatrade'
  | 'other';

export interface BrokerConfig {
  id: string;
  name: BrokerName;
  displayName: string;
  type: BrokerType;
}

export const BROKER_PRESETS: Record<BrokerName, { displayName: string; type: BrokerType }> = {
  tradeville: { displayName: 'TradeVille', type: 'resident' },
  goldring: { displayName: 'Goldring', type: 'resident' },
  xtb_ro: { displayName: 'XTB România', type: 'resident' },
  bt_capital: { displayName: 'BT Capital Partners', type: 'resident' },
  swiss_capital: { displayName: 'Swiss Capital', type: 'resident' },
  ibkr: { displayName: 'Interactive Brokers', type: 'nonresident' },
  trading212: { displayName: 'Trading 212', type: 'nonresident' },
  etoro: { displayName: 'eToro', type: 'nonresident' },
  revolut: { displayName: 'Revolut', type: 'nonresident' },
  xtb: { displayName: 'XTB (Polonia)', type: 'nonresident' },
  avatrade: { displayName: 'AvaTrade', type: 'nonresident' },
  other: { displayName: 'Altul', type: 'nonresident' },
};
