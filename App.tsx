import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  getDocFromServer,
  getDocs
} from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { Trade, TradeStatus, TradeType, UserSettings, Account } from './types';
import { 
  Plus, 
  LogOut, 
  TrendingUp, 
  TrendingDown, 
  LayoutDashboard, 
  List, 
  Settings as SettingsIcon,
  BarChart3,
  Calendar,
  DollarSign,
  PieChart,
  ChevronRight,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  Clock,
  Palette,
  Target,
  Moon,
  Sun,
  ArrowUpRight as ArrowIcon,
  BookOpen,
  Users,
  MessageSquare,
  Paperclip,
  GraduationCap,
  RefreshCw,
  Edit3,
  History,
  Zap,
  ChevronDown,
  Layers,
  Activity
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart as RePieChart,
  Pie,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, show a toast here
}

// --- Components ---

const CalendarView = ({ trades }: { trades: Trade[] }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getDayPnL = (day: Date) => {
    return trades
      .filter(t => t.status === 'closed' && t.exitDate && isSameDay(t.exitDate.toDate(), day))
      .reduce((acc, t) => acc + (t.pnl || 0), 0);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-black dark:text-white">Daily PnL Calendar</h3>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-black/60 dark:text-white/60">{format(currentMonth, 'MMMM yyyy')}</span>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
              <ChevronRight className="rotate-180" size={18} />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-white dark:bg-[#1a1a1a] p-3 text-center text-[10px] font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">
            {day}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const pnl = getDayPnL(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          
          return (
            <div 
              key={i} 
              className={cn(
                "min-h-[100px] p-3 bg-white dark:bg-[#1a1a1a] transition-colors",
                !isCurrentMonth && "opacity-20"
              )}
            >
              <span className="text-xs font-medium text-black/60 dark:text-white/70">{format(day, 'd')}</span>
              {pnl !== 0 && (
                <div className={cn(
                  "mt-2 p-2 rounded-lg text-[10px] font-bold text-center",
                  pnl > 0 ? "bg-green-500/10 text-green-500 dark:text-green-400" : "bg-red-500/10 text-red-500 dark:text-red-400"
                )}>
                  {pnl > 0 ? '+' : ''}{pnl.toFixed(0)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AccountModal = ({ 
  isOpen, 
  onClose, 
  user, 
  editingAccount 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  user: User | null;
  editingAccount: Account | null;
}) => {
  const [formData, setFormData] = useState({
    name: '',
    initialBalance: 0,
    maxDailyLoss: 0,
    maxDrawdown: 0,
  });

  useEffect(() => {
    if (editingAccount) {
      setFormData({
        name: editingAccount.name,
        initialBalance: editingAccount.initialBalance,
        maxDailyLoss: editingAccount.maxDailyLoss,
        maxDrawdown: editingAccount.maxDrawdown,
      });
    } else {
      setFormData({
        name: '',
        initialBalance: 50000,
        maxDailyLoss: 2500,
        maxDrawdown: 5000,
      });
    }
  }, [editingAccount, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingAccount) {
        await updateDoc(doc(db, 'accounts', editingAccount.id), {
          ...formData,
        });
      } else {
        await addDoc(collection(db, 'accounts'), {
          ...formData,
          userId: user.uid,
          createdAt: Timestamp.now(),
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, editingAccount ? OperationType.UPDATE : OperationType.CREATE, 'accounts');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#151515] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10"
      >
        <div className="p-6 border-b border-black/10 dark:border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-black dark:text-white">{editingAccount ? 'Edit Account' : 'New Prop Account'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
            <X size={20} className="text-black/60 dark:text-white/70" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Account Name</label>
            <input 
              required
              type="text"
              className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. My Funded Account"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Initial Balance</label>
              <input 
                required
                type="number"
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                value={formData.initialBalance}
                onChange={e => setFormData({...formData, initialBalance: parseFloat(e.target.value)})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Max Daily Loss</label>
              <input 
                required
                type="number"
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                value={formData.maxDailyLoss}
                onChange={e => setFormData({...formData, maxDailyLoss: parseFloat(e.target.value)})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Max Drawdown</label>
            <input 
              required
              type="number"
              className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
              value={formData.maxDrawdown}
              onChange={e => setFormData({...formData, maxDrawdown: parseFloat(e.target.value)})}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 transition-colors"
            >
              {editingAccount ? 'Update' : 'Create Account'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const TradeModal = ({ 
  isOpen, 
  onClose, 
  user, 
  editingTrade,
  accounts,
  selectedAccount
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  user: User | null;
  editingTrade: Trade | null;
  accounts: Account[];
  selectedAccount: Account | null;
}) => {
  const [formData, setFormData] = useState({
    symbol: '',
    type: 'long' as TradeType,
    entryPrice: 0,
    exitPrice: 0,
    quantity: 0,
    status: 'open' as TradeStatus,
    entryDate: new Date().toISOString().slice(0, 16),
    exitDate: new Date().toISOString().slice(0, 16),
    notes: '',
    accountId: selectedAccount?.id || '',
    imageUrl: '',
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
    }
    if (editingTrade) {
      setFormData({
        symbol: editingTrade.symbol,
        type: editingTrade.type,
        entryPrice: editingTrade.entryPrice,
        exitPrice: editingTrade.exitPrice || 0,
        quantity: editingTrade.quantity,
        status: editingTrade.status,
        entryDate: editingTrade.entryDate?.toDate ? format(editingTrade.entryDate.toDate(), "yyyy-MM-dd'T'HH:mm") : '',
        exitDate: editingTrade.exitDate?.toDate ? format(editingTrade.exitDate.toDate(), "yyyy-MM-dd'T'HH:mm") : '',
        notes: editingTrade.notes || '',
        accountId: editingTrade.accountId || '',
        imageUrl: editingTrade.imageUrl || '',
      });
    } else {
      setFormData({
        symbol: '',
        type: 'long',
        entryPrice: 0,
        exitPrice: 0,
        quantity: 0,
        status: 'open',
        entryDate: new Date().toISOString().slice(0, 16),
        exitDate: '',
        notes: '',
        accountId: selectedAccount?.id || '',
        imageUrl: '',
      });
    }
  }, [editingTrade, isOpen, selectedAccount]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
      setValidationError('Image too large. Please use a smaller file (< 500KB).');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, imageUrl: reader.result as string });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setValidationError(null);

    const entryDateObj = new Date(formData.entryDate);
    const exitDateObj = formData.exitDate ? new Date(formData.exitDate) : null;

    if (formData.status === 'closed' && exitDateObj && entryDateObj) {
      if (exitDateObj < entryDateObj) {
        setValidationError('Exit date cannot be before entry date.');
        return;
      }
    }

    const pnl = formData.status === 'closed' 
      ? (formData.type === 'long' 
        ? (formData.exitPrice - formData.entryPrice) * formData.quantity
        : (formData.entryPrice - formData.exitPrice) * formData.quantity)
      : 0;

    const tradeData = {
      ...formData,
      userId: user.uid,
      pnl,
      entryDate: Timestamp.fromDate(entryDateObj),
      exitDate: formData.status === 'closed' && exitDateObj ? Timestamp.fromDate(exitDateObj) : null,
    };

    try {
      if (editingTrade) {
        await updateDoc(doc(db, 'trades', editingTrade.id), tradeData);
      } else {
        await addDoc(collection(db, 'trades'), tradeData);
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, editingTrade ? OperationType.UPDATE : OperationType.CREATE, 'trades');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-black/10 dark:border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-black dark:text-white">
            {editingTrade ? 'Edit Trade' : 'New Trade'}
          </h2>
          <button onClick={onClose} className="text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {validationError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 dark:text-red-400 text-sm flex items-center gap-2"
            >
              <X size={16} />
              {validationError}
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Account</label>
              <select 
                required
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                value={formData.accountId}
                onChange={e => setFormData({...formData, accountId: e.target.value})}
              >
                <option value="">Select Account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Symbol</label>
              <input 
                required
                type="text"
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                value={formData.symbol}
                onChange={e => setFormData({...formData, symbol: e.target.value.toUpperCase()})}
                placeholder="e.g. BTC/USD"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Type</label>
              <select 
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as TradeType})}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Status</label>
              <select 
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as TradeStatus})}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Entry Price</label>
              <input 
                required
                type="number"
                step="any"
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                value={formData.entryPrice}
                onChange={e => setFormData({...formData, entryPrice: parseFloat(e.target.value)})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Quantity</label>
              <input 
                required
                type="number"
                step="any"
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})}
              />
            </div>
          </div>

          {formData.status === 'closed' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-wider">Exit Price</label>
                <input 
                  required
                  type="number"
                  step="any"
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                  value={formData.exitPrice}
                  onChange={e => setFormData({...formData, exitPrice: parseFloat(e.target.value)})}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Entry Date</label>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, entryDate: new Date().toISOString().slice(0, 16)})}
                  className="text-[10px] text-accent hover:underline"
                >
                  Set Now
                </button>
              </div>
              <input 
                required
                type="datetime-local"
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                value={formData.entryDate as string}
                onChange={e => setFormData({...formData, entryDate: e.target.value})}
              />
            </div>
            {formData.status === 'closed' && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Exit Date</label>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, exitDate: new Date().toISOString().slice(0, 16)})}
                    className="text-[10px] text-accent hover:underline"
                  >
                    Set Now
                  </button>
                </div>
                <input 
                  type="datetime-local"
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors"
                  value={formData.exitDate as string}
                  onChange={e => setFormData({...formData, exitDate: e.target.value})}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Notes</label>
            <textarea 
              className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors h-24 resize-none"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder="Trade rationale, emotional state, etc."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-black/60 dark:text-white/70 uppercase tracking-wider">Screenshot</label>
            <div className="flex flex-col gap-4">
              {formData.imageUrl && (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
                  <img src={formData.imageUrl} alt="Screenshot" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, imageUrl: '' })}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="relative">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="screenshot-upload"
                />
                <label 
                  htmlFor="screenshot-upload"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-black/10 dark:border-white/10 rounded-xl text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20 transition-all cursor-pointer"
                >
                  {isUploading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <RefreshCw size={18} />
                    </motion.div>
                  ) : (
                    <Plus size={18} />
                  )}
                  <span className="font-medium text-black/60 dark:text-white/70">{formData.imageUrl ? 'Change Screenshot' : 'Upload Screenshot'}</span>
                </label>
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-black/10 dark:border-white/10 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 transition-colors"
          >
            Save Trade
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Community View ---
const CommunityView = ({ user, settings }: { user: User | null, settings: UserSettings | null }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    newSocket.emit('join-room', 'ftm-community');

    newSocket.on('receive-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !user) return;

    socket.emit('send-message', {
      room: 'ftm-community',
      text: newMessage,
      user: {
        name: user.displayName || 'Anonymous',
        photo: user.photoURL,
        id: user.uid
      }
    });
    setNewMessage('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !socket) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      socket.emit('send-message', {
        room: 'ftm-community',
        file: data,
        user: {
          name: user.displayName || 'Anonymous',
          photo: user.photoURL,
          id: user.uid
        }
      });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 rounded-3xl overflow-hidden relative shadow-sm dark:shadow-none">
      {/* Background Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.04] dark:opacity-[0.06] z-0">
        <span className="text-[35vw] font-black uppercase whitespace-nowrap rotate-[-12deg] text-black dark:text-white leading-none tracking-tighter">
          bad boy's for life
        </span>
      </div>

      {/* Header */}
      <div className="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-white/50 dark:bg-[#151515]/50 backdrop-blur-xl z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-black dark:text-white">FTM Community</h3>
            <p className="text-black/40 dark:text-white/40 text-sm font-medium">Real-time trading floor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-[#151515] bg-black/10 dark:bg-white/10 overflow-hidden">
                <img src={`https://picsum.photos/seed/${i}/32/32`} alt="user" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
          <span className="text-xs font-bold text-black/40 dark:text-white/40 ml-2 uppercase tracking-widest">24 Online</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 z-10 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
            <MessageSquare size={48} className="text-black dark:text-white" />
            <p className="text-sm font-medium text-black dark:text-white">No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map((msg) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id}
            className={cn(
              "flex gap-4 max-w-[80%]",
              msg.user.id === user?.uid ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-black/10 dark:border-white/10">
              <img src={msg.user.photo || `https://ui-avatars.com/api/?name=${msg.user.name}`} alt={msg.user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className={cn(
              "space-y-1",
              msg.user.id === user?.uid ? "text-right" : "text-left"
            )}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-black/60 dark:text-white/70">{msg.user.name}</span>
                <span className="text-[10px] text-black/20 dark:text-white/20">{format(new Date(msg.timestamp), 'HH:mm')}</span>
              </div>
              <div className={cn(
                "p-4 rounded-2xl text-sm shadow-sm",
                msg.user.id === user?.uid 
                  ? "bg-accent text-white rounded-tr-none" 
                  : "bg-black/5 dark:bg-white/5 text-black dark:text-white rounded-tl-none"
              )}>
                {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                {msg.file && (
                  <div className="space-y-2">
                    {msg.file.type.startsWith('image/') ? (
                      <img src={msg.file.url} alt={msg.file.name} className="rounded-lg max-w-full h-auto border border-black/10 dark:border-white/10" referrerPolicy="no-referrer" />
                    ) : (
                      <a href={msg.file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-black/10 dark:bg-white/10 rounded-xl hover:bg-black/20 dark:hover:bg-white/20 transition-colors">
                        <Paperclip size={18} />
                        <div className="text-left">
                          <p className="font-bold text-xs truncate max-w-[150px]">{msg.file.name}</p>
                          <p className="text-[10px] opacity-60 uppercase">Download File</p>
                        </div>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-black/10 dark:border-white/10 bg-white/50 dark:bg-[#151515]/50 backdrop-blur-xl z-10">
        <form onSubmit={handleSendMessage} className="flex items-center gap-4">
          <label className="p-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-2xl text-black/40 dark:text-white/40 cursor-pointer transition-colors">
            <Paperclip size={20} />
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-accent transition-all text-black dark:text-white placeholder:text-black/20 dark:placeholder:text-white/20"
            />
          </div>
          <button
            type="submit"
            disabled={(!newMessage.trim() && !isUploading) || isUploading}
            className="p-4 bg-accent text-white rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-accent/20"
          >
            {isUploading ? <RefreshCw className="animate-spin" size={20} /> : <Zap size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Main App ---

const AnalyticsView = ({ stats, settings }: { stats: any, settings: UserSettings | null }) => {
  return (
    <div className="space-y-8 pb-20">
      {/* Key Metrics Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="text-green-500" size={20} />
            </div>
            <span className="text-[10px] font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Net PnL</span>
          </div>
          <div>
            <h3 className={cn("text-3xl font-bold", stats.totalPnL >= 0 ? "text-green-500" : "text-red-500")}>
              {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(2)}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-black/60 dark:text-white/70 uppercase tracking-wider">Total Growth</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <PieChart className="text-blue-500" size={20} />
            </div>
            <span className="text-[10px] font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Win Rate</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-black dark:text-white">{stats.winRate.toFixed(1)}%</h3>
            <div className="mt-2 w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-500" 
                style={{ width: `${stats.winRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Target className="text-purple-500" size={20} />
            </div>
            <span className="text-[10px] font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Profit Factor</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-black dark:text-white">{stats.profitFactor.toFixed(2)}</h3>
            <p className="text-[10px] font-bold text-black/60 dark:text-white/70 uppercase tracking-wider mt-1">Efficiency Ratio</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Zap className="text-orange-500" size={20} />
            </div>
            <span className="text-[10px] font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Expectancy</span>
          </div>
          <div>
            <h3 className={cn("text-3xl font-bold", stats.expectancy >= 0 ? "text-green-500" : "text-red-500")}>
              ${stats.expectancy.toFixed(2)}
            </h3>
            <p className="text-[10px] font-bold text-black/60 dark:text-white/70 uppercase tracking-wider mt-1">Per Trade Value</p>
          </div>
        </div>
      </div>

      {/* Cumulative PnL Chart */}
      <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-8 rounded-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold text-black dark:text-white">Cumulative Profit</h3>
            <p className="text-sm text-black/60 dark:text-white/70">Total account equity over time</p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Best: ${stats.bestTrade.toFixed(0)}
            </div>
            <div className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Worst: ${stats.worstTrade.toFixed(0)}
            </div>
          </div>
        </div>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.chartData}>
              <defs>
                <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={settings?.themeColor || '#F27D26'} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={settings?.themeColor || '#F27D26'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={settings?.theme === 'light' ? '#00000010' : '#ffffff08'} vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke={settings?.theme === 'light' ? '#00000060' : '#ffffff70'} 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke={settings?.theme === 'light' ? '#00000060' : '#ffffff70'} 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: settings?.theme === 'light' ? '#fff' : '#1a1a1a', 
                  border: settings?.theme === 'light' ? '1px solid #00000010' : '1px solid #ffffff10', 
                  borderRadius: '12px',
                  color: settings?.theme === 'light' ? '#000' : '#fff'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke={settings?.themeColor || '#F27D26'} 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorPnL)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution & Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-8 rounded-3xl space-y-8">
          <div>
            <h3 className="text-lg font-bold text-black dark:text-white mb-4">Win/Loss Distribution</h3>
            <div className="flex h-4 w-full rounded-full overflow-hidden">
              <div 
                className="bg-green-500 h-full transition-all duration-500" 
                style={{ width: `${stats.winRate}%` }}
              />
              <div 
                className="bg-red-500 h-full transition-all duration-500" 
                style={{ width: `${100 - stats.winRate}%` }}
              />
            </div>
            <div className="flex justify-between mt-3 text-[10px] font-bold uppercase tracking-widest">
              <span className="text-green-500">{stats.winningTradesCount} Wins</span>
              <span className="text-red-500">{stats.losingTradesCount} Losses</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
              <span className="text-xs font-bold text-black/60 dark:text-white/70 uppercase tracking-wider">Avg Win</span>
              <span className="text-sm font-bold text-green-500">${stats.avgWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
              <span className="text-xs font-bold text-black/60 dark:text-white/70 uppercase tracking-wider">Avg Loss</span>
              <span className="text-sm font-bold text-red-500">${stats.avgLoss.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
              <span className="text-xs font-bold text-black/60 dark:text-white/70 uppercase tracking-wider">Max Drawdown</span>
              <span className="text-sm font-bold text-red-500">${stats.maxDrawdown.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
              <span className="text-xs font-bold text-black/60 dark:text-white/70 uppercase tracking-wider">Consistency</span>
              <span className="text-sm font-bold text-blue-500">{stats.consistencyScore.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-8 rounded-3xl">
          <h3 className="text-lg font-bold text-black dark:text-white mb-8">Performance by Symbol</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.symbolData}>
                <CartesianGrid strokeDasharray="3 3" stroke={settings?.theme === 'light' ? '#00000010' : '#ffffff08'} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke={settings?.theme === 'light' ? '#00000060' : '#ffffff70'} 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke={settings?.theme === 'light' ? '#00000060' : '#ffffff70'} 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: settings?.theme === 'light' ? '#fff' : '#1a1a1a', 
                    border: settings?.theme === 'light' ? '1px solid #00000010' : '1px solid #ffffff10', 
                    borderRadius: '12px'
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={1500}>
                  {stats.symbolData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance by Day */}
      <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-8 rounded-3xl">
        <h3 className="text-lg font-bold text-black dark:text-white mb-8">Performance by Day of Week</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke={settings?.theme === 'light' ? '#00000010' : '#ffffff08'} vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke={settings?.theme === 'light' ? '#00000060' : '#ffffff70'} 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke={settings?.theme === 'light' ? '#00000060' : '#ffffff70'} 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: settings?.theme === 'light' ? '#fff' : '#1a1a1a', 
                  border: settings?.theme === 'light' ? '1px solid #00000010' : '1px solid #ffffff10', 
                  borderRadius: '12px'
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={1500}>
                {stats.dayData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trades' | 'settings' | 'journal' | 'analytics' | 'playbook' | 'reports' | 'notebook' | 'community'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [tradeToDelete, setTradeToDelete] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Settings Listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'accounts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accountsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Account[];
      setAccounts(accountsData);
      
      // Auto-select first account if none selected
      if (accountsData.length > 0 && !selectedAccount) {
        setSelectedAccount(accountsData[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'accounts');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'userSettings', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as UserSettings;
        setSettings(data);
        if (data.themeColor) {
          document.documentElement.style.setProperty('--accent-color', data.themeColor);
        }
        if (data.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        // Default to dark mode if no settings exist
        setSettings({ theme: 'dark', themeColor: '#F27D26', userId: user.uid });
        document.documentElement.classList.add('dark');
        document.documentElement.style.setProperty('--accent-color', '#F27D26');
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Connection Test
  useEffect(() => {
    if (isAuthReady && user) {
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if(error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }
      };
      testConnection();
    }
  }, [isAuthReady, user]);

  // Trades Listener
  useEffect(() => {
    if (!user) {
      setTrades([]);
      return;
    }

    const q = query(
      collection(db, 'trades'),
      where('userId', '==', user.uid),
      orderBy('entryDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tradesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trade[];
      setTrades(tradesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trades');
    });

    return () => unsubscribe();
  }, [user]);

  const handleSaveTrade = async (tradeData: Partial<Trade>) => {
    if (!user) return;

    try {
      if (editingTrade) {
        await updateDoc(doc(db, 'trades', editingTrade.id), tradeData);
      } else {
        await addDoc(collection(db, 'trades'), {
          ...tradeData,
          userId: user.uid,
        });
      }
      setEditingTrade(null);
    } catch (error) {
      handleFirestoreError(error, editingTrade ? OperationType.UPDATE : OperationType.CREATE, 'trades');
    }
  };

  const handleDeleteTrade = async () => {
    if (!tradeToDelete) return;
    try {
      await deleteDoc(doc(db, 'trades', tradeToDelete));
      setTradeToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trades/${tradeToDelete}`);
    }
  };

  const handleClearData = async () => {
    if (!user) return;
    setIsClearing(true);

    try {
      const q = query(collection(db, 'trades'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'trades', d.id)));
      await Promise.all(deletePromises);
      setShowClearConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'trades/all');
    } finally {
      setIsClearing(false);
    }
  };

  const stats = React.useMemo(() => {
    const filteredTrades = selectedAccount 
      ? trades.filter(t => t.accountId === selectedAccount.id)
      : trades;

    const closedTrades = filteredTrades.filter(t => t.status === 'closed');
    const totalPnL = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const winRate = closedTrades.length > 0 
      ? (closedTrades.filter(t => (t.pnl || 0) > 0).length / closedTrades.length) * 100 
      : 0;
    const totalTrades = filteredTrades.length;
    const openTrades = filteredTrades.filter(t => t.status === 'open').length;
    
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) / losingTrades.length)
      : 0;
    
    const profitFactor = avgLoss > 0 
      ? (winningTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) / Math.abs(losingTrades.reduce((acc, t) => acc + (t.pnl || 0), 0)))
      : winningTrades.length > 0 ? 99 : 0;

    const expectancy = closedTrades.length > 0
      ? ((winRate / 100) * avgWin) - ((1 - winRate / 100) * avgLoss)
      : 0;

    const bestTrade = closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl || 0)) : 0;
    const worstTrade = closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl || 0)) : 0;

    // Performance by Symbol
    const symbolPnL = closedTrades.reduce((acc: Record<string, number>, t) => {
      acc[t.symbol] = (acc[t.symbol] || 0) + (t.pnl || 0);
      return acc;
    }, {});
    const symbolData = Object.entries(symbolPnL).map(([name, value]) => ({ name, value }));

    // Performance by Day of Week
    const dayPnL = closedTrades.reduce((acc: Record<string, number>, t) => {
      if (!t.exitDate) return acc;
      const day = format(t.exitDate.toDate(), 'EEEE');
      acc[day] = (acc[day] || 0) + (t.pnl || 0);
      return acc;
    }, {});
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayData = days.map(day => ({ name: day, value: dayPnL[day] || 0 }));

    // Prop Firm Metrics
    const today = new Date();
    const dailyPnL = closedTrades
      .filter(t => t.exitDate && isSameDay(t.exitDate.toDate(), today))
      .reduce((acc, t) => acc + (t.pnl || 0), 0);

    // Weekly PnL
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    const weeklyPnL = closedTrades
      .filter(t => t.exitDate && t.exitDate.toDate() >= weekStart && t.exitDate.toDate() <= weekEnd)
      .reduce((acc, t) => acc + (t.pnl || 0), 0);

    // Monthly PnL
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const monthlyPnL = closedTrades
      .filter(t => t.exitDate && t.exitDate.toDate() >= monthStart && t.exitDate.toDate() <= monthEnd)
      .reduce((acc, t) => acc + (t.pnl || 0), 0);

    // Daily Win/Loss Average
    const pnlByDay = closedTrades.reduce((acc: Record<string, number>, t) => {
      if (!t.exitDate) return acc;
      const dayKey = format(t.exitDate.toDate(), 'yyyy-MM-dd');
      acc[dayKey] = (acc[dayKey] || 0) + (t.pnl || 0);
      return acc;
    }, {});
    const dailyPnLs = Object.values(pnlByDay);
    const winningDays = dailyPnLs.filter(p => p > 0);
    const losingDays = dailyPnLs.filter(p => p < 0);
    const avgDailyWin = winningDays.length > 0 ? winningDays.reduce((a, b) => a + b, 0) / winningDays.length : 0;
    const avgDailyLoss = losingDays.length > 0 ? Math.abs(losingDays.reduce((a, b) => a + b, 0) / losingDays.length) : 0;
    const avgDailyPnL = dailyPnLs.length > 0 
      ? dailyPnLs.reduce((a, b) => a + b, 0) / dailyPnLs.length 
      : 0;

    // Drawdown calculation
    let peak = 0;
    let currentBalance = selectedAccount?.initialBalance || 0;
    let maxDrawdown = 0;
    
    const sortedClosed = [...closedTrades].sort((a, b) => a.exitDate.toMillis() - b.exitDate.toMillis());
    sortedClosed.forEach(t => {
      currentBalance += (t.pnl || 0);
      if (currentBalance > peak) peak = currentBalance;
      const drawdown = peak - currentBalance;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    // Consistency Score (Standard deviation of position sizes)
    const sizes = closedTrades.map(t => t.quantity);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / (sizes.length || 1);
    const variance = sizes.reduce((a, b) => a + Math.pow(b - avgSize, 2), 0) / (sizes.length || 1);
    const consistencyScore = Math.max(0, 100 - (Math.sqrt(variance) / (avgSize || 1)) * 100);

    // Radar Data
    const radarData = [
      { subject: 'Profitability', A: winRate, fullMark: 100 },
      { subject: 'Risk Mgmt', A: Math.min(100, (avgWin / (avgLoss || 1)) * 20), fullMark: 100 },
      { subject: 'Consistency', A: consistencyScore, fullMark: 100 },
      { subject: 'Efficiency', A: Math.min(100, profitFactor * 25), fullMark: 100 },
      { subject: 'Volume', A: Math.min(100, (totalTrades / 20) * 100), fullMark: 100 },
    ];

    // Chart Data
    const chartData = [...filteredTrades]
      .filter(t => t.status === 'closed' && t.exitDate)
      .sort((a, b) => a.exitDate.toMillis() - b.exitDate.toMillis())
      .reduce((acc: any[], t) => {
        const lastPnL = acc.length > 0 ? acc[acc.length - 1].balance : (selectedAccount?.initialBalance || 0);
        acc.push({
          date: format(t.exitDate.toDate(), 'MMM dd'),
          balance: lastPnL + (t.pnl || 0)
        });
        return acc;
      }, []);

    return { 
      totalPnL, 
      winRate, 
      totalTrades, 
      openTrades, 
      chartData, 
      avgWin, 
      avgLoss, 
      profitFactor, 
      radarData,
      dailyPnL,
      weeklyPnL,
      monthlyPnL,
      avgDailyPnL,
      avgDailyWin,
      avgDailyLoss,
      maxDrawdown,
      consistencyScore,
      expectancy,
      bestTrade,
      worstTrade,
      symbolData,
      dayData,
      winningTradesCount: winningTrades.length,
      losingTradesCount: losingTrades.length,
      totalClosedTrades: closedTrades.length
    };
  }, [trades, selectedAccount]);

  const updateThemeColor = async (color: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'userSettings', user.uid), {
        themeColor: color,
        userId: user.uid
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'userSettings');
    }
  };

  const updateTheme = async (theme: 'light' | 'dark') => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'userSettings', user.uid), {
        theme,
        userId: user.uid
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'userSettings');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center space-y-8"
        >
          <div className="space-y-2">
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-accent/20">
              <TrendingUp className="text-black" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">FTM</h1>
            <p className="text-white/70 text-lg">Professional Trading Journal</p>
          </div>
          
          <button 
            onClick={loginWithGoogle}
            className="w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/90 transition-all shadow-lg shadow-white/5 active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>
          
          <p className="text-white/40 text-sm">
            Securely track your trades and analyze your performance.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-black dark:text-white flex flex-col md:flex-row transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10 p-6 flex flex-col gap-8 bg-white dark:bg-[#0a0a0a] z-10 transition-colors duration-300">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-lg shadow-accent/20">
              <TrendingUp className="text-black" size={18} />
            </div>
            <span className="text-xl font-bold tracking-tight text-black dark:text-white">FTM</span>
          </div>

          {/* Account Switcher */}
          <div className="px-2 space-y-2">
            <label className="text-[10px] font-bold text-black/40 dark:text-white/50 uppercase tracking-widest block">Active Account</label>
            <div className="relative group">
              <select 
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-black dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer"
                value={selectedAccount?.id || ''}
                onChange={(e) => {
                  const acc = accounts.find(a => a.id === e.target.value);
                  if (acc) setSelectedAccount(acc);
                }}
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id} className="bg-white dark:bg-[#1a1a1a]">{acc.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/60 dark:text-white/70">
                <ChevronDown size={14} />
              </div>
            </div>
            <button 
              onClick={() => {
                setEditingAccount(null);
                setIsAccountModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold text-accent hover:bg-accent/5 rounded-lg transition-colors uppercase tracking-wider"
            >
              <Plus size={12} />
              Manage Accounts
            </button>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <span className="text-[10px] font-bold text-black/40 dark:text-white/50 uppercase tracking-widest px-4 mb-2 block">Main Menu</span>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === 'dashboard' ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('journal')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === 'journal' ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <BookOpen size={20} />
            <span className="font-medium">Daily Journal</span>
          </button>
          <button 
            onClick={() => setActiveTab('trades')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === 'trades' ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <History size={20} />
            <span className="font-medium">Trades</span>
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === 'analytics' ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <BarChart3 size={20} />
            <span className="font-medium">Analytics</span>
          </button>
          <button 
            onClick={() => setActiveTab('playbook')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === 'playbook' ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <Target size={20} />
            <span className="font-medium">Playbook</span>
          </button>
          <button 
            onClick={() => setActiveTab('community')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === 'community' ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <Users size={20} />
            <span className="font-medium">Community</span>
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === 'reports' ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <PieChart size={20} />
            <span className="font-medium">Reports</span>
          </button>
          <button 
            onClick={() => setActiveTab('notebook')}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === 'notebook' ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <Edit3 size={20} />
            <span className="font-medium">Notebook</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-black/10 dark:border-white/10 space-y-4">
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === 'settings' ? "bg-black/5 dark:bg-white/10 text-black dark:text-white" : "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <SettingsIcon size={20} />
            <span className="font-medium">Settings</span>
          </button>
          <div className="flex items-center gap-3 px-2">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10" alt="Profile" />
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate text-black dark:text-white">{user.displayName}</span>
              <span className="text-xs text-black/40 dark:text-white/40 truncate">{user.email}</span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-black/40 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>

          <button 
            onClick={() => setShowClearConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-black/40 dark:text-white/40 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-600/5 transition-all"
          >
            <Trash2 size={20} />
            <span className="font-medium">Clear All Data</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col bg-white dark:bg-[#0a0a0a] transition-colors duration-300">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-black dark:text-white capitalize">
              {activeTab === 'dashboard' ? 'Performance' : activeTab === 'analytics' ? 'Detailed Analytics' : activeTab === 'community' ? 'FTM Community' : activeTab}
            </h2>
            <p className="text-black/40 dark:text-white/40 mt-1">
              {activeTab === 'dashboard' ? 'Analyze your trading edge' : 
               activeTab === 'analytics' ? 'Deep dive into your trading data' : 
               activeTab === 'trades' ? 'Review and manage your records' : 
               activeTab === 'settings' ? 'Customize your experience' :
               activeTab === 'community' ? 'Real-time community chat and file sharing' :
               `Manage your ${activeTab} and strategy`}
            </p>
          </div>
          {activeTab !== 'settings' && activeTab !== 'community' && (
            <button 
              onClick={() => {
                setEditingTrade(null);
                setIsModalOpen(true);
              }}
              className="bg-accent text-black px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-accent/20 active:scale-[0.98]"
            >
              <Plus size={20} />
              Add Trade
            </button>
          )}
        </header>

        {activeTab === 'dashboard' ? (
          <div className="space-y-8">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <DollarSign className="text-green-500 dark:text-green-400" size={20} />
                    </div>
                    <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Net PnL</span>
                  </div>
                  <div>
                    <h3 className={cn("text-3xl font-bold", stats.totalPnL >= 0 ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400")}>
                      {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(2)}
                    </h3>
                    <p className="text-black/40 dark:text-white/50 text-sm mt-1">Total account growth</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <PieChart className="text-blue-500 dark:text-blue-400" size={20} />
                    </div>
                    <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Win Rate</span>
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-black dark:text-white">{stats.winRate.toFixed(1)}%</h3>
                    <p className="text-black/40 dark:text-white/50 text-sm mt-1">Winning percentage</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Target className="text-purple-500 dark:text-purple-400" size={20} />
                    </div>
                    <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Profit Factor</span>
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-black dark:text-white">{stats.profitFactor.toFixed(2)}</h3>
                    <p className="text-black/40 dark:text-white/50 text-sm mt-1">Risk/Reward efficiency</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <BarChart3 className="text-orange-500 dark:text-orange-400" size={20} />
                    </div>
                    <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Avg Win/Loss</span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-green-500 dark:text-green-400">${stats.avgWin.toFixed(0)}</span>
                      <span className="text-black/40 dark:text-white/50">/</span>
                      <span className="text-xl font-bold text-red-500 dark:text-red-400">${stats.avgLoss.toFixed(0)}</span>
                    </div>
                    <p className="text-black/40 dark:text-white/50 text-sm mt-1">Avg performance</p>
                  </div>
                </div>
              </div>

              <div className="bg-accent text-black p-6 rounded-3xl flex flex-col justify-between shadow-lg shadow-accent/20">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Active Trades</span>
                  <ArrowIcon size={20} className="opacity-40" />
                </div>
                <div>
                  <h3 className="text-4xl font-bold">{stats.openTrades}</h3>
                  <p className="text-sm font-medium opacity-60">Currently in market</p>
                </div>
              </div>
            </div>

            {/* Prop Firm Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <TrendingDown className="text-red-500 dark:text-red-400" size={20} />
                  </div>
                  <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Max Drawdown</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold text-red-500 dark:text-red-400">
                      ${stats.maxDrawdown.toFixed(2)}
                    </h3>
                    {selectedAccount && (
                      <span className="text-xs font-medium text-black/40 dark:text-white/50">
                        / ${selectedAccount.maxDrawdown.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-red-500 h-full transition-all duration-500" 
                      style={{ width: `${selectedAccount ? Math.min((stats.maxDrawdown / selectedAccount.maxDrawdown) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Clock className="text-orange-500 dark:text-orange-400" size={20} />
                  </div>
                  <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Daily PnL</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <h3 className={cn("text-3xl font-bold", stats.dailyPnL >= 0 ? "text-green-500" : "text-red-500")}>
                      ${stats.dailyPnL.toFixed(2)}
                    </h3>
                    {selectedAccount && (
                      <span className="text-xs font-medium text-black/40 dark:text-white/50">
                        Limit: ${selectedAccount.maxDailyLoss.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-500", stats.dailyPnL >= 0 ? "bg-green-500" : "bg-red-500")}
                      style={{ width: `${selectedAccount ? Math.min((Math.abs(stats.dailyPnL) / selectedAccount.maxDailyLoss) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Zap className="text-blue-500 dark:text-blue-400" size={20} />
                  </div>
                  <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Consistency</span>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-black dark:text-white">{stats.consistencyScore.toFixed(1)}%</h3>
                  <p className="text-black/40 dark:text-white/50 text-sm mt-1">Position sizing variance</p>
                  <div className="mt-2 w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-500" 
                      style={{ width: `${stats.consistencyScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Periods Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Calendar className="text-purple-500 dark:text-purple-400" size={20} />
                  </div>
                  <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Weekly PnL</span>
                </div>
                <div>
                  <h3 className={cn("text-3xl font-bold", stats.weeklyPnL >= 0 ? "text-green-500" : "text-red-500")}>
                    {stats.weeklyPnL >= 0 ? '+' : ''}${stats.weeklyPnL.toFixed(2)}
                  </h3>
                  <p className="text-black/40 dark:text-white/50 text-sm mt-1">Current week performance</p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Layers className="text-indigo-500 dark:text-indigo-400" size={20} />
                  </div>
                  <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Monthly PnL</span>
                </div>
                <div>
                  <h3 className={cn("text-3xl font-bold", stats.monthlyPnL >= 0 ? "text-green-500" : "text-red-500")}>
                    {stats.monthlyPnL >= 0 ? '+' : ''}${stats.monthlyPnL.toFixed(2)}
                  </h3>
                  <p className="text-black/40 dark:text-white/50 text-sm mt-1">Current month performance</p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-6 rounded-3xl space-y-4 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-teal-500/10 rounded-lg">
                    <Activity className="text-teal-500 dark:text-teal-400" size={20} />
                  </div>
                  <span className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Avg Daily PnL</span>
                </div>
                <div>
                  <h3 className={cn("text-3xl font-bold", stats.avgDailyPnL >= 0 ? "text-green-500" : "text-red-500")}>
                    {stats.avgDailyPnL >= 0 ? '+' : ''}${stats.avgDailyPnL.toFixed(2)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-green-500/80 uppercase tracking-wider">+${stats.avgDailyWin.toFixed(0)}</span>
                    <span className="text-black/20 dark:text-white/20">/</span>
                    <span className="text-[10px] font-bold text-red-500/80 uppercase tracking-wider">-${stats.avgDailyLoss.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Calendar & Equity */}
              <div className="lg:col-span-2 space-y-8">
                <CalendarView trades={trades} />
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-8 rounded-3xl shadow-sm dark:shadow-none"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-black dark:text-white">Equity Curve</h3>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-xs font-medium text-black/40 dark:text-white/40">Performance Trend</span>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={settings?.theme === 'light' ? '#00000010' : '#ffffff08'} vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke={settings?.theme === 'light' ? '#00000060' : '#ffffff70'} 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis 
                          stroke={settings?.theme === 'light' ? '#00000060' : '#ffffff70'} 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: settings?.theme === 'light' ? '#fff' : '#1a1a1a', 
                            border: settings?.theme === 'light' ? '1px solid #00000010' : '1px solid #ffffff10', 
                            borderRadius: '12px',
                            color: settings?.theme === 'light' ? '#000' : '#fff'
                          }}
                          itemStyle={{ color: settings?.theme === 'light' ? '#000' : '#fff' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="balance" 
                          stroke={settings?.themeColor || '#F27D26'} 
                          strokeWidth={3} 
                          dot={false}
                          activeDot={{ r: 6, fill: settings?.themeColor || '#F27D26', stroke: settings?.theme === 'light' ? '#fff' : '#000', strokeWidth: 2 }}
                          animationDuration={2000}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>

              {/* Right Column: Performance Radar & Quick Stats */}
              <div className="space-y-8">
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-8 rounded-3xl shadow-sm dark:shadow-none"
                >
                  <h3 className="text-xl font-bold text-black dark:text-white mb-6 text-center">Performance Radar</h3>
                  <div className="h-[300px] w-full flex justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats.radarData}>
                        <PolarGrid stroke={settings?.theme === 'light' ? '#00000010' : '#ffffff10'} />
                        <PolarAngleAxis 
                          dataKey="subject" 
                          tick={{ fill: settings?.theme === 'light' ? '#00000060' : '#ffffff60', fontSize: 10 }} 
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          name="Performance"
                          dataKey="A"
                          stroke="var(--accent-color)"
                          fill="var(--accent-color)"
                          fillOpacity={0.3}
                          animationDuration={2000}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl text-center">
                      <span className="block text-[10px] font-bold text-black/40 dark:text-white/50 uppercase tracking-widest mb-1">Total Trades</span>
                      <span className="text-xl font-bold">{stats.totalTrades}</span>
                    </div>
                    <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl text-center">
                      <span className="block text-[10px] font-bold text-black/40 dark:text-white/50 uppercase tracking-widest mb-1">Avg Duration</span>
                      <span className="text-xl font-bold">2.4h</span>
                    </div>
                  </div>
                </motion.div>

                <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-8 rounded-3xl shadow-sm dark:shadow-none space-y-6">
                  <h3 className="text-lg font-bold text-black dark:text-white">Recent Activity</h3>
                  <div className="space-y-4">
                    {trades.slice(0, 3).map(trade => (
                      <div key={trade.id} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            trade.status === 'open' ? "bg-blue-400" : (trade.pnl || 0) >= 0 ? "bg-green-400" : "bg-red-400"
                          )} />
                          <div>
                            <span className="block text-sm font-bold">{trade.symbol}</span>
                            <span className="text-[10px] text-black/60 dark:text-white/70 uppercase font-bold tracking-wider">{trade.type}</span>
                          </div>
                        </div>
                        <span className={cn(
                          "text-sm font-bold",
                          trade.status === 'open' ? "text-white/40" : (trade.pnl || 0) >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {trade.status === 'open' ? 'OPEN' : `$${trade.pnl?.toFixed(0)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setActiveTab('trades')}
                    className="w-full py-3 text-xs font-bold text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors uppercase tracking-widest"
                  >
                    View All History
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'analytics' ? (
          <AnalyticsView stats={stats} settings={settings} />
        ) : activeTab === 'community' ? (
          <CommunityView user={user} settings={settings} />
        ) : ['journal', 'playbook', 'reports', 'notebook'].includes(activeTab) ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-6">
            <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-3xl flex items-center justify-center text-black/20 dark:text-white/20">
              {activeTab === 'journal' && <BookOpen size={40} />}
              {activeTab === 'playbook' && <Target size={40} />}
              {activeTab === 'reports' && <PieChart size={40} />}
              {activeTab === 'notebook' && <Edit3 size={40} />}
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold uppercase tracking-widest text-black dark:text-white">Coming Soon</h3>
              <p className="text-black/40 dark:text-white/40 text-sm mt-2">We're building the ultimate {activeTab} experience for you.</p>
            </div>
          </div>
        ) : activeTab === 'trades' ? (
          <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10">
                    <th className="p-6 text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Date</th>
                    <th className="p-6 text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Symbol</th>
                    <th className="p-6 text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Type</th>
                    <th className="p-6 text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Entry</th>
                    <th className="p-6 text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Exit</th>
                    <th className="p-6 text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">PnL</th>
                    <th className="p-6 text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-20 text-center text-black/20 dark:text-white/20">
                        No trades found. Start by adding your first trade.
                      </td>
                    </tr>
                  ) : (
                    trades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group">
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className="font-medium text-black dark:text-white">{trade.entryDate ? format(trade.entryDate.toDate(), 'MMM dd, yyyy') : '-'}</span>
                            <span className="text-xs text-black/40 dark:text-white/50">{trade.entryDate ? format(trade.entryDate.toDate(), 'HH:mm') : ''}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            {trade.imageUrl && (
                              <div className="w-12 h-12 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 flex-shrink-0">
                                <img src={trade.imageUrl} alt="Trade" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <span className="font-bold tracking-tight text-black dark:text-white">{trade.symbol}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            trade.type === 'long' ? "bg-green-500/10 text-green-500 dark:text-green-400" : "bg-red-500/10 text-red-500 dark:text-red-400"
                          )}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="p-6">
                          <span className="text-black/70 dark:text-white/80">${trade.entryPrice.toFixed(2)}</span>
                        </td>
                        <td className="p-6">
                          <span className="text-black/70 dark:text-white/80">
                            {trade.status === 'closed' ? `$${trade.exitPrice?.toFixed(2)}` : '-'}
                          </span>
                        </td>
                        <td className="p-6">
                          {trade.status === 'closed' ? (
                            <span className={cn("font-bold", (trade.pnl || 0) >= 0 ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400")}>
                              {(trade.pnl || 0) >= 0 ? '+' : ''}{trade.pnl?.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-black/20 dark:text-white/20 italic text-sm">Open</span>
                          )}
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEditingTrade(trade);
                                setIsModalOpen(true);
                              }}
                              className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => setTradeToDelete(trade.id)}
                              className="p-2 hover:bg-red-500/10 rounded-lg text-black/40 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl space-y-8">
            <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-8 rounded-3xl space-y-6 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/10 rounded-2xl">
                  <Palette className="text-accent" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black dark:text-white">Appearance</h3>
                  <p className="text-black/40 dark:text-white/40 text-sm">Personalize your journal's look and feel</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Theme Mode</label>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => updateTheme('light')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all",
                        settings?.theme === 'light' 
                          ? "bg-accent/5 border-accent text-accent" 
                          : "bg-black/5 dark:bg-white/5 border-transparent text-black/60 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10"
                      )}
                    >
                      <Sun size={20} />
                      <span className="font-bold">Light</span>
                    </button>
                    <button 
                      onClick={() => updateTheme('dark')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all",
                        settings?.theme === 'dark' 
                          ? "bg-accent/5 border-accent text-accent" 
                          : "bg-black/5 dark:bg-white/5 border-transparent text-black/60 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10"
                      )}
                    >
                      <Moon size={20} />
                      <span className="font-bold">Dark</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-black/40 dark:text-white/50 uppercase tracking-widest">Accent Color</label>
                  <div className="flex flex-wrap gap-4">
                    {['#F27D26', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#6366F1'].map((color) => (
                      <button
                        key={color}
                        onClick={() => updateThemeColor(color)}
                        className={cn(
                          "w-12 h-12 rounded-2xl border-4 transition-all",
                          settings?.themeColor === color ? "border-black dark:border-white scale-110" : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <div className="relative group">
                      <input 
                        type="color"
                        value={settings?.themeColor || '#F27D26'}
                        onChange={(e) => updateThemeColor(e.target.value)}
                        className="w-12 h-12 rounded-2xl bg-transparent border-4 border-black/10 dark:border-white/10 cursor-pointer overflow-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#151515] border border-black/10 dark:border-white/10 p-8 rounded-3xl space-y-6 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl">
                  <SettingsIcon className="text-black/60 dark:text-white/70" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black dark:text-white">Account Settings</h3>
                  <p className="text-black/60 dark:text-white/70 text-sm">Manage your profile and data</p>
                </div>
              </div>
              <div className="p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 text-sm text-black/60 dark:text-white/70 italic">
                More settings coming soon...
              </div>
            </div>
          </div>
        )}

        <footer className="mt-auto pt-20 pb-10 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-black/40 dark:text-white/50 text-xs font-mono uppercase tracking-[0.3em]">
              <span>FTM Trading Journal</span>
              <span className="w-1 h-1 bg-black/40 dark:bg-white/50 rounded-full"></span>
              <span>All Rights Reserved</span>
            </div>
            <p className="text-[10px] text-black/20 dark:text-white/30 font-mono">© 2026 ALL RIGHTS RESERVED</p>
          </div>
        </footer>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <TradeModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            user={user}
            editingTrade={editingTrade}
            accounts={accounts}
            selectedAccount={selectedAccount}
          />
        )}
        {isAccountModalOpen && (
          <AccountModal 
            isOpen={isAccountModalOpen} 
            onClose={() => setIsAccountModalOpen(false)} 
            user={user}
            editingAccount={editingAccount}
          />
        )}
        {tradeToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#151515] w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-black dark:text-white">Delete Trade?</h3>
                <p className="text-black/60 dark:text-white/70 text-sm">This action cannot be undone. Are you sure you want to remove this trade from your journal?</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setTradeToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteTrade}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {showClearConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-[#151515] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 p-8 space-y-6"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-4 bg-red-500/10 rounded-full text-red-500">
                  <Trash2 size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black dark:text-white">Clear All Data?</h3>
                  <p className="text-black/60 dark:text-white/70 text-sm mt-2">
                    This will permanently delete all your trades across all accounts. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearing}
                  className="flex-1 px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClearData}
                  disabled={isClearing}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isClearing ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <RefreshCw size={18} />
                    </motion.div>
                  ) : 'Delete All'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
