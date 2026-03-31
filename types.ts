export type TradeType = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';

export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  type: TradeType;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  entryDate: any; // Firestore Timestamp
  exitDate?: any; // Firestore Timestamp
  status: TradeStatus;
  notes?: string;
  pnl?: number;
  imageUrl?: string;
  tags?: string[];
  accountId?: string;
}

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  userId: string;
  createdAt: any;
}

export interface UserSettings {
  userId: string;
  displayName?: string;
  currency?: string;
  themeColor?: string;
  theme?: 'light' | 'dark';
  selectedAccountId?: string;
}
