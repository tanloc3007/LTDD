const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: __dirname + '/.env' });

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
<<<<<<< Updated upstream

app.use(cors());
app.use(express.json());
=======
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID || '';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const CLOUDINARY_AVATAR_FOLDER = process.env.CLOUDINARY_AVATAR_FOLDER || 'financial-management/avatars';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';

function buildCorsOptions() {
  if (!CORS_ORIGIN.trim()) {
    return { origin: true, credentials: true };
  }

  const allowedOrigins = CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };
}

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '15mb' }));

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});
>>>>>>> Stashed changes

// ---- SCHEMAS ----

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['expense', 'income'], required: true },
    category: { type: String, required: true },
    note: { type: String, default: '' },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

const budgetCategorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: String, required: true },
    label: { type: String, required: true },
    icon: { type: String, default: 'wallet' },
    color: { type: String, default: '#E91E8C' },
    budgetAmount: { type: Number, required: true, min: 0 },
    month: { type: String, required: true }, // format: "MM/YYYY"
  },
  { timestamps: true }
);

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['expense', 'income', 'budget_warning', 'budget_over', 'recurring', 'other'], default: 'other' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const globalLimitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    limitAmount: { type: Number, required: true, min: 0 },
    month: { type: String, required: true }, // format: "MM/YYYY"
  },
  { timestamps: true }
);

const categorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true },
    icon: { type: String, default: 'apps' },
    color: { type: String, default: '#8892A4' },
    type: { type: String, enum: ['expense', 'income'], default: 'expense' },
  },
  { timestamps: true }
);

// ---- NEW SCHEMAS ----

const savingGoalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    icon: { type: String, default: 'save' },
    color: { type: String, default: '#E91E8C' },
    targetAmount: { type: Number, required: true, min: 0 },
    currentAmount: { type: Number, default: 0 },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['active', 'completed', 'failed'], default: 'active' },
  },
  { timestamps: true }
);

const groupWalletSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const groupExpenseSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupWallet', required: true, index: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    note: { type: String, default: '' },
    date: { type: String, required: true },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidByName: { type: String },
  },
  { timestamps: true }
);

const recurringTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['expense', 'income'] },
    category: { type: String, required: true },
    note: { type: String, default: '' },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    dayOfMonth: { type: Number, min: 1, max: 31 }, // for monthly
    nextRunDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ---- MODELS ----

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const BudgetCategory = mongoose.model('BudgetCategory', budgetCategorySchema);
const Notification = mongoose.model('Notification', notificationSchema);
const GlobalLimit = mongoose.model('GlobalLimit', globalLimitSchema);
const Category = mongoose.model('Category', categorySchema);
const SavingGoal = mongoose.model('SavingGoal', savingGoalSchema);
const GroupWallet = mongoose.model('GroupWallet', groupWalletSchema);
const GroupExpense = mongoose.model('GroupExpense', groupExpenseSchema);
const RecurringTransaction = mongoose.model('RecurringTransaction', recurringTransactionSchema);

// ---- HELPERS ----

function createToken(user) {
  return jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
}

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
  };
}

function mapTransaction(transaction) {
  return {
    id: transaction._id.toString(),
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    note: transaction.note,
    date: transaction.date,
  };
}

function generateGroupCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function calcNextRunDate(frequency, dayOfMonth) {
  const now = new Date();
  if (frequency === 'daily') {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  } else if (frequency === 'weekly') {
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    next.setHours(0, 0, 0, 0);
    return next;
  } else if (frequency === 'monthly') {
    const day = dayOfMonth || 1;
    const candidate = new Date(now.getFullYear(), now.getMonth(), day, 0, 0, 0, 0);
    if (candidate <= now) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  }
  return new Date(now.setDate(now.getDate() + 1));
}

function advanceNextRunDate(frequency, dayOfMonth, fromDate) {
  const base = new Date(fromDate);
  if (frequency === 'daily') {
    base.setDate(base.getDate() + 1);
    return base;
  } else if (frequency === 'weekly') {
    base.setDate(base.getDate() + 7);
    return base;
  } else if (frequency === 'monthly') {
    const day = dayOfMonth || 1;
    const next = new Date(base.getFullYear(), base.getMonth() + 1, day, 0, 0, 0, 0);
    return next;
  }
  return base;
}

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Chua dang nhap.' });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: 'Tai khoan khong ton tai.' });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Phien dang nhap khong hop le.' });
  }
}

// ---- ROUTES ----

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Vui long nhap day du thong tin.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Mat khau phai co it nhat 6 ky tu.' });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: 'Email nay da duoc dang ky.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, passwordHash });
    const token = createToken(user);

    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (error) {
    return res.status(500).json({ message: 'Khong the dang ky tai khoan.' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui long nhap email va mat khau.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Email hoac mat khau khong dung.' });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Email hoac mat khau khong dung.' });
    }

    return res.json({ user: sanitizeUser(user), token: createToken(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Khong the dang nhap.' });
  }
});

<<<<<<< Updated upstream
=======
// ---- SOCIAL LOGIN (Google / Facebook) ----

app.post('/auth/social-login', async (req, res) => {
  try {
    const { provider, token, name, email, avatar } = req.body;
    if (!provider || !token) {
      return res.status(400).json({ message: 'Thiếu thông tin đăng nhập.' });
    }

    let verifiedEmail = email;
    let verifiedName  = name;
    let providerId    = null;
    let verifiedAvatar = avatar || null;

    if (provider === 'google') {
      if (!GOOGLE_WEB_CLIENT_ID) {
        return res.status(500).json({ message: 'Google sign-in is not configured.' });
      }
      // Xác thực idToken với Google
      const gRes  = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      const gData = await gRes.json();

      if (!gRes.ok || gData.error) {
        return res.status(401).json({ message: 'Token Google không hợp lệ.' });
      }
      // Kiểm tra audience khớp với Web Client ID
      if (gData.aud !== GOOGLE_WEB_CLIENT_ID) {
        return res.status(401).json({ message: 'Token không đúng ứng dụng.' });
      }

      verifiedEmail = gData.email;
      verifiedName  = gData.name || name;
      providerId    = gData.sub;
    } else if (provider === 'facebook') {
      const fbRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(token)}`
      );
      const fbData = await fbRes.json();

      if (!fbRes.ok || fbData.error) {
        return res.status(401).json({ message: 'Token Facebook khong hop le.' });
      }

      verifiedEmail = fbData.email || email;
      verifiedName  = fbData.name || name;
      providerId    = fbData.id;
      verifiedAvatar = fbData.picture?.data?.url || avatar || null;
    } else {
      return res.status(400).json({ message: 'Provider không được hỗ trợ.' });
    }

    if (!verifiedEmail) {
      return res.status(400).json({ message: 'Không lấy được email từ tài khoản mạng xã hội.' });
    }

    // Tìm user theo email
    let user = await User.findOne({ email: verifiedEmail.toLowerCase().trim() });

    if (!user) {
      // Tạo user mới (không có password)
      user = await User.create({
        name:     verifiedName || verifiedEmail.split('@')[0],
        email:    verifiedEmail.toLowerCase().trim(),
        phone:    '',
        passwordHash: null,
        provider,
        providerId,
        avatar:   verifiedAvatar,
      });
    } else {
      // User đã tồn tại (có thể đăng ký bằng email trước) → cập nhật avatar nếu chưa có
      if (verifiedAvatar && !user.avatar) {
        user.avatar = verifiedAvatar;
        await user.save();
      }
    }

    return res.json({ user: sanitizeUser(user), token: createToken(user) });
  } catch (error) {
    console.error('Social login error:', error);
    return res.status(500).json({ message: 'Không thể đăng nhập bằng mạng xã hội.' });
  }
});

>>>>>>> Stashed changes
app.get('/transactions', authRequired, async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ transactions: transactions.map(mapTransaction) });
});

app.post('/transactions', authRequired, async (req, res) => {
  try {
    const { amount, type, category, note, date } = req.body;
    if (!amount || !type || !category || !date) {
      return res.status(400).json({ message: 'Thieu thong tin giao dich.' });
    }

    const transaction = await Transaction.create({
      userId: req.user._id,
      amount,
      type,
      category,
      note,
      date,
    });

    // Check budget
    if (type === 'expense') {
      const parts = String(date).split('/');
      let monthKey = '';
      if (parts.length >= 3) {
        monthKey = `${parts[1].padStart(2, '0')}/${parts[2]}`;
      } else {
        const now = new Date();
        monthKey = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      }

      const budget = await BudgetCategory.findOne({ userId: req.user._id, categoryId: category, month: monthKey });
      if (budget) {
        const txs = await Transaction.find({ userId: req.user._id, type: 'expense', category });
        const total = txs.filter(t => {
          const tParts = String(t.date).split('/');
          const tMonthKey = tParts.length >= 3 ? `${tParts[1].padStart(2, '0')}/${tParts[2]}` : monthKey;
          return tMonthKey === monthKey;
        }).reduce((s, t) => s + t.amount, 0);

        if (total > budget.budgetAmount) {
          await Notification.create({ userId: req.user._id, message: `Vuot ngan sach danh muc "${budget.label}" ${Number(total - budget.budgetAmount).toLocaleString('vi-VN')}d!`, type: 'budget_over' });
        } else if (total / budget.budgetAmount >= 0.8) {
          await Notification.create({ userId: req.user._id, message: `Da dung ${Math.round(total / budget.budgetAmount * 100)}% ngan sach "${budget.label}"`, type: 'budget_warning' });
        }
      }

      // Check global limit
      const globalLimit = await GlobalLimit.findOne({ userId: req.user._id, month: monthKey });
      if (globalLimit) {
        const allTxs = await Transaction.find({ userId: req.user._id, type: 'expense' });
        const allTotal = allTxs.filter(t => {
          const tParts = String(t.date).split('/');
          const tMonthKey = tParts.length >= 3 ? `${tParts[1].padStart(2, '0')}/${tParts[2]}` : monthKey;
          return tMonthKey === monthKey;
        }).reduce((s, t) => s + t.amount, 0);

        if (allTotal > globalLimit.limitAmount * 1.2) {
          await Notification.create({ userId: req.user._id, message: `CANH BAO DO: Tong chi tieu da vuot qua 120% han muc thang! (${Number(allTotal - globalLimit.limitAmount).toLocaleString('vi-VN')}d)`, type: 'budget_over' });
        } else if (allTotal > globalLimit.limitAmount) {
          await Notification.create({ userId: req.user._id, message: `Vuot han muc tong thang nay! (${Number(allTotal - globalLimit.limitAmount).toLocaleString('vi-VN')}d)`, type: 'budget_over' });
        } else if (allTotal / globalLimit.limitAmount >= 0.8) {
          await Notification.create({ userId: req.user._id, message: `Canh bao: Tong chi tieu da dat ${Math.round(allTotal / globalLimit.limitAmount * 100)}% han muc thang`, type: 'budget_warning' });
        }
      }
    }

    res.status(201).json({ transaction: mapTransaction(transaction) });
  } catch (error) {
    res.status(500).json({ message: 'Khong the luu giao dich.' });
  }
});

app.put('/transactions/:id', authRequired, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!transaction) return res.status(404).json({ message: 'Khong tim thay giao dich.' });
    res.json({ transaction: mapTransaction(transaction) });
  } catch (error) {
    res.status(500).json({ message: 'Khong the cap nhat giao dich.' });
  }
});

app.delete('/transactions/:id', authRequired, async (req, res) => {
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!transaction) return res.status(404).json({ message: 'Khong tim thay giao dich.' });
  res.json({ ok: true });
});

// ---- GLOBAL LIMITS ----
app.get('/limits', authRequired, async (req, res) => {
  const { month } = req.query; // "MM/YYYY"
  const filter = { userId: req.user._id };
  if (month) filter.month = month;
  const limit = await GlobalLimit.findOne(filter).sort({ createdAt: -1 });
  res.json({ limit });
});

app.post('/limits', authRequired, async (req, res) => {
  try {
    const { limitAmount, month } = req.body;
    if (!limitAmount || !month) {
      return res.status(400).json({ message: 'Thieu thong tin han muc.' });
    }
    const limit = await GlobalLimit.findOneAndUpdate(
      { userId: req.user._id, month },
      { limitAmount },
      { new: true, upsert: true }
    );

    const allTxs = await Transaction.find({ userId: req.user._id, type: 'expense' });
    const allTotal = allTxs.filter(t => {
      const tParts = String(t.date).split('/');
      const tMonthKey = tParts.length >= 3 ? `${tParts[1].padStart(2, '0')}/${tParts[2]}` : month;
      return tMonthKey === month;
    }).reduce((s, t) => s + t.amount, 0);

    if (allTotal > limit.limitAmount * 1.2) {
      await Notification.create({ userId: req.user._id, message: `CANH BAO DO: Tong chi tieu da vuot qua 120% han muc thang vua thiet lap! (${Number(allTotal - limit.limitAmount).toLocaleString('vi-VN')}d)`, type: 'budget_over' });
    } else if (allTotal > limit.limitAmount) {
      await Notification.create({ userId: req.user._id, message: `Vuot han muc tong thang vua thiet lap! (${Number(allTotal - limit.limitAmount).toLocaleString('vi-VN')}d)`, type: 'budget_over' });
    } else if (allTotal / limit.limitAmount >= 0.8) {
      await Notification.create({ userId: req.user._id, message: `Canh bao: Tong chi tieu hien tai da dat ${Math.round(allTotal / limit.limitAmount * 100)}% han muc thang vua thiet lap`, type: 'budget_warning' });
    }

    res.status(200).json({ limit });
  } catch (error) {
    res.status(500).json({ message: 'Khong the tao han muc.' });
  }
});

// ---- BUDGET CATEGORIES ----
app.get('/budgets', authRequired, async (req, res) => {
  const { month } = req.query; // "MM/YYYY"
  const filter = { userId: req.user._id };
  if (month) filter.month = month;
  const budgets = await BudgetCategory.find(filter).sort({ createdAt: 1 });
  res.json({ budgets });
});

app.post('/budgets', authRequired, async (req, res) => {
  try {
    const { categoryId, label, icon, color, budgetAmount, month } = req.body;
    if (!categoryId || !label || !budgetAmount || !month) {
      return res.status(400).json({ message: 'Thieu thong tin ngan sach.' });
    }
    const exists = await BudgetCategory.findOne({ userId: req.user._id, categoryId, month });
    if (exists) {
      return res.status(409).json({ message: 'Danh muc nay da co ngan sach trong thang.' });
    }
    const budget = await BudgetCategory.create({ userId: req.user._id, categoryId, label, icon, color, budgetAmount, month });
    res.status(201).json({ budget });
  } catch (error) {
    res.status(500).json({ message: 'Khong the tao ngan sach.' });
  }
});

app.put('/budgets/:id', authRequired, async (req, res) => {
  try {
    const budget = await BudgetCategory.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!budget) return res.status(404).json({ message: 'Khong tim thay ngan sach.' });
    res.json({ budget });
  } catch (error) {
    res.status(500).json({ message: 'Khong the cap nhat ngan sach.' });
  }
});

app.delete('/budgets/:id', authRequired, async (req, res) => {
  const budget = await BudgetCategory.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!budget) return res.status(404).json({ message: 'Khong tim thay ngan sach.' });
  res.json({ ok: true });
});

// ---- NOTIFICATIONS ----
app.get('/notifications', authRequired, async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ notifications });
});

app.post('/notifications', authRequired, async (req, res) => {
  const { message, type } = req.body;
  const notification = await Notification.create({ userId: req.user._id, message, type });
  res.status(201).json({ notification });
});

app.post('/notifications/read-all', authRequired, async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
});

app.delete('/notifications/:id', authRequired, async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  res.json({ ok: true });
});

// ---- CATEGORIES ----
app.get('/categories', authRequired, async (req, res) => {
  const categories = await Category.find({ userId: req.user._id }).sort({ createdAt: 1 });
  res.json({ categories });
});

app.post('/categories', authRequired, async (req, res) => {
  try {
    const { label, icon, color, type } = req.body;
    if (!label) return res.status(400).json({ message: 'Ten danh muc khong duoc de trong.' });
    
    const category = await Category.create({
      userId: req.user._id,
      label,
      icon: icon || 'apps',
      color: color || '#8892A4',
      type: type || 'expense',
    });
    res.status(201).json({ category });
  } catch (error) {
    res.status(500).json({ message: 'Khong the tao danh muc.' });
  }
});

// ---- USER PROFILE & SETTINGS ----
app.put('/user/profile', authRequired, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Ten khong duoc de trong.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim() },
      { new: true }
    );
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ message: 'Khong the cap nhat ho so.' });
  }
});

app.put('/auth/change-password', authRequired, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Vui long nhap day du mat khau cu va moi.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mat khau moi phai co it nhat 6 ky tu.' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mat khau cu khong chinh xac.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    res.json({ ok: true, message: 'Doi mat khau thanh cong.' });
  } catch (error) {
    res.status(500).json({ message: 'Khong the doi mat khau.' });
  }
});

app.delete('/user/data', authRequired, async (req, res) => {
  try {
    const userId = req.user._id;
    await Transaction.deleteMany({ userId });
    await BudgetCategory.deleteMany({ userId });
    await GlobalLimit.deleteMany({ userId });
    await Notification.deleteMany({ userId });
    

    res.json({ ok: true, message: 'Da xoa toan bo du lieu.' });
  } catch (error) {
    res.status(500).json({ message: 'Khong the xoa du lieu.' });
  }
});

app.get('/user/export', authRequired, async (req, res) => {
  try {
    const userId = req.user._id;
    const transactions = await Transaction.find({ userId });
    const budgets = await BudgetCategory.find({ userId });
    const limits = await GlobalLimit.find({ userId });
    const notifications = await Notification.find({ userId });

    res.json({
      transactions,
      budgets,
      limits,
      notifications
    });
  } catch (error) {
    res.status(500).json({ message: 'Khong the xuat du lieu.' });
  }
});

app.post('/user/import', authRequired, async (req, res) => {
  try {
    const userId = req.user._id;
    const { transactions, budgets, limits, notifications } = req.body;

    // Clear existing
    await Transaction.deleteMany({ userId });
    await BudgetCategory.deleteMany({ userId });
    await GlobalLimit.deleteMany({ userId });
    await Notification.deleteMany({ userId });

    // Insert new
    if (transactions && transactions.length) {
      await Transaction.insertMany(transactions.map(t => ({ ...t, userId, _id: undefined })));
    }
    if (budgets && budgets.length) {
      await BudgetCategory.insertMany(budgets.map(b => ({ ...b, userId, _id: undefined })));
    }
    if (limits && limits.length) {
      await GlobalLimit.insertMany(limits.map(l => ({ ...l, userId, _id: undefined })));
    }
    if (notifications && notifications.length) {
      await Notification.insertMany(notifications.map(n => ({ ...n, userId, _id: undefined })));
    }

    res.json({ ok: true, message: 'Phuc hoi du lieu thanh cong.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Khong the phuc hoi du lieu.' });
  }
});

// ---- AI CHAT ----
app.post('/ai-chat', authRequired, async (req, res) => {
  try {
    const { input, contextData } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      return res.status(500).json({ message: 'GROQ_API_KEY chua duoc thiet lap tren server.' });
    }

    const promptContext = `
      Ban la mot tro ly tai chinh thong minh cua ung dung FinancialManagement Finance.
      Nguoi dung ten la ${req.user.name}.
      Du lieu tai chinh hien tai cua nguoi dung:
      - Tong giao dich: ${contextData?.totalTransactions || 0}
      - Tong chi tieu thang nay: ${contextData?.totalExpense || '0 VND'}
      - Tong thu nhap thang nay: ${contextData?.totalIncome || '0 VND'}
      - Cac ngan sach dang co: ${contextData?.budgetsInfo || 'Chua thiet lap ngan sach'}
      
      Hay tra loi bang tieng Viet, than thien, ngan gon va dua ra cac loi khuyen thuc te.
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: promptContext },
          { role: 'user', content: input }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Groq Error:', errorData);
      return res.status(500).json({ message: 'Loi tu Groq API.' });
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;

    res.json({ text: responseText || 'Xin loi, toi chua co cau tra loi phu hop luc nay.' });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ message: 'Co loi xay ra khi ket noi voi AI.' });
  }
});

// ---- AI BUDGET SUGGESTIONS ----
app.post('/ai-budget-suggestions', authRequired, async (req, res) => {
  try {
    const { income, expenses, currentBudgets } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      return res.status(500).json({ message: 'GROQ_API_KEY chua duoc thiet lap tren server.' });
    }

    const systemPrompt = `
      Ban la chuyen gia tu van tai chinh ca nhan. Nhiem vu cua ban la dua ra goi y ngan sach chi tieu.
      CHI TRA VE DU LIEU DUOI DANG MANG JSON. TUYET DOI KHONG GIAI THICH, KHONG CHAO HOI.
      
      Dinh dang mang JSON:
      [
        {"id": "suggest_1", "label": "An uong", "suggestion": "2.000.000d", "icon": "restaurant", "color": "#FF6B35"},
        {"id": "suggest_2", "label": "Mua sam", "suggestion": "1.500.000d", "icon": "cart", "color": "#FF9500"},
        {"id": "suggest_3", "label": "Di chuyen", "suggestion": "1.000.000d", "icon": "car", "color": "#178BFF"}
      ]
      
      Quy tac:
      - "id" la duy nhat.
      - "label" la ten danh muc.
      - "suggestion" la so tien kem d (vd: 500.000d).
      - "icon" la ten icon tu Ionicons (restaurant, cart, car, leaf, play-circle, receipt, book, brush, body, home, heart, wallet).
      - "color" la ma mau HEX.
    `;

    const userPrompt = `
      Du lieu nguoi dung:
      - Thu nhap: ${income}
      - Chi tieu: ${expenses}
      - Ngan sach hien tai: ${currentBudgets || 'Chua co'}
      
      Hay goi y 3 muc ngan sach phu hop nhat. Chi tra ve JSON.
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0
      })
    });

    if (!response.ok) return res.status(500).json({ message: 'Loi API AI.' });

    const data = await response.json();
    let text = data.choices[0].message.content.trim();
    
    // Extract JSON array
    const startBracket = text.indexOf('[');
    const endBracket = text.lastIndexOf(']');
    
    if (startBracket !== -1 && endBracket !== -1 && startBracket < endBracket) {
      text = text.substring(startBracket, endBracket + 1);
    }

    try {
      const suggestions = JSON.parse(text);
      res.json({ suggestions });
    } catch (e) {
      console.error('Parse AI JSON failed. Text received:', text);
      res.status(500).json({ message: 'AI tra ve dinh dang khong hop le.' });
    }
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    res.status(500).json({ message: 'Co loi xay ra.' });
  }
});

// ---- SAVING GOALS ----
app.get('/saving-goals', authRequired, async (req, res) => {
  try {
    const goals = await SavingGoal.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ goals });
  } catch (error) {
    res.status(500).json({ message: 'Khong the lay danh sach hu tiet kiem.' });
  }
});

app.post('/saving-goals', authRequired, async (req, res) => {
  try {
    const { title, icon, color, targetAmount, deadline } = req.body;
    if (!title || !targetAmount || !deadline) {
      return res.status(400).json({ message: 'Thieu thong tin hu tiet kiem.' });
    }
    const goal = await SavingGoal.create({
      userId: req.user._id,
      title,
      icon: icon || 'save',
      color: color || '#E91E8C',
      targetAmount,
      deadline: new Date(deadline),
    });
    res.status(201).json({ goal });
  } catch (error) {
    res.status(500).json({ message: 'Khong the tao hu tiet kiem.' });
  }
});

app.put('/saving-goals/:id', authRequired, async (req, res) => {
  try {
    const goal = await SavingGoal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!goal) return res.status(404).json({ message: 'Khong tim thay hu tiet kiem.' });
    res.json({ goal });
  } catch (error) {
    res.status(500).json({ message: 'Khong the cap nhat hu tiet kiem.' });
  }
});

app.delete('/saving-goals/:id', authRequired, async (req, res) => {
  try {
    const goal = await SavingGoal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Khong tim thay hu tiet kiem.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Khong the xoa hu tiet kiem.' });
  }
});

app.post('/saving-goals/:id/deposit', authRequired, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'So tien khong hop le.' });
    }
    const goal = await SavingGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Khong tim thay hu tiet kiem.' });

    goal.currentAmount = (goal.currentAmount || 0) + Number(amount);
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = 'completed';
    }
    await goal.save();
    res.json({ goal });
  } catch (error) {
    res.status(500).json({ message: 'Khong the nap tien vao hu.' });
  }
});

app.post('/saving-goals/:id/withdraw', authRequired, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'So tien khong hop le.' });
    }
    const goal = await SavingGoal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Khong tim thay hu tiet kiem.' });

    if (Number(amount) > goal.currentAmount) {
      return res.status(400).json({ message: 'So du trong hu khong du.' });
    }
    goal.currentAmount = goal.currentAmount - Number(amount);
    if (goal.status === 'completed' && goal.currentAmount < goal.targetAmount) {
      goal.status = 'active';
    }
    await goal.save();
    res.json({ goal });
  } catch (error) {
    res.status(500).json({ message: 'Khong the rut tien tu hu.' });
  }
});

// ---- GROUP WALLET ----
app.post('/group-wallet', authRequired, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Ten nhom khong duoc de trong.' });

    // Generate unique code
    let code = generateGroupCode();
    let existing = await GroupWallet.findOne({ code });
    while (existing) {
      code = generateGroupCode();
      existing = await GroupWallet.findOne({ code });
    }

    const group = await GroupWallet.create({
      name,
      code,
      createdBy: req.user._id,
      members: [{ userId: req.user._id, name: req.user.name, joinedAt: new Date() }],
    });
    res.status(201).json({ group });
  } catch (error) {
    res.status(500).json({ message: 'Khong the tao nhom.' });
  }
});

app.post('/group-wallet/join', authRequired, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Vui long nhap ma nhom.' });

    const group = await GroupWallet.findOne({ code: String(code).toUpperCase() });
    if (!group) return res.status(404).json({ message: 'Khong tim thay nhom voi ma nay.' });

    const alreadyMember = group.members.some(m => m.userId.toString() === req.user._id.toString());
    if (alreadyMember) {
      return res.status(409).json({ message: 'Ban da la thanh vien cua nhom nay.' });
    }

    group.members.push({ userId: req.user._id, name: req.user.name, joinedAt: new Date() });
    await group.save();
    res.json({ group });
  } catch (error) {
    res.status(500).json({ message: 'Khong the tham gia nhom.' });
  }
});

app.get('/group-wallet', authRequired, async (req, res) => {
  try {
    const groups = await GroupWallet.find({ 'members.userId': req.user._id }).sort({ createdAt: -1 });
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ message: 'Khong the lay danh sach nhom.' });
  }
});

app.get('/group-wallet/:groupId/expenses', authRequired, async (req, res) => {
  try {
    const group = await GroupWallet.findOne({ _id: req.params.groupId, 'members.userId': req.user._id });
    if (!group) return res.status(403).json({ message: 'Ban khong co quyen truy cap nhom nay.' });

    const expenses = await GroupExpense.find({ groupId: req.params.groupId }).sort({ createdAt: -1 });
    res.json({ expenses });
  } catch (error) {
    res.status(500).json({ message: 'Khong the lay chi tieu nhom.' });
  }
});

app.post('/group-wallet/:groupId/expenses', authRequired, async (req, res) => {
  try {
    const group = await GroupWallet.findOne({ _id: req.params.groupId, 'members.userId': req.user._id });
    if (!group) return res.status(403).json({ message: 'Ban khong co quyen truy cap nhom nay.' });

    const { amount, category, note, date } = req.body;
    if (!amount || !category || !date) {
      return res.status(400).json({ message: 'Thieu thong tin chi tieu.' });
    }

    const expense = await GroupExpense.create({
      groupId: req.params.groupId,
      amount,
      category,
      note: note || '',
      date,
      paidBy: req.user._id,
      paidByName: req.user.name,
    });
    res.status(201).json({ expense });
  } catch (error) {
    res.status(500).json({ message: 'Khong the them chi tieu nhom.' });
  }
});

app.delete('/group-wallet/:groupId/expenses/:expenseId', authRequired, async (req, res) => {
  try {
    const group = await GroupWallet.findOne({ _id: req.params.groupId, 'members.userId': req.user._id });
    if (!group) return res.status(403).json({ message: 'Ban khong co quyen truy cap nhom nay.' });

    const expense = await GroupExpense.findOneAndDelete({
      _id: req.params.expenseId,
      groupId: req.params.groupId,
    });
    if (!expense) return res.status(404).json({ message: 'Khong tim thay chi tieu.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Khong the xoa chi tieu.' });
  }
});

app.delete('/group-wallet/:groupId/leave', authRequired, async (req, res) => {
  try {
    const group = await GroupWallet.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Khong tim thay nhom.' });

    const memberIndex = group.members.findIndex(m => m.userId.toString() === req.user._id.toString());
    if (memberIndex === -1) return res.status(400).json({ message: 'Ban khong phai thanh vien nhom nay.' });

    group.members.splice(memberIndex, 1);
    await group.save();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Khong the roi nhom.' });
  }
});

// ---- RECURRING TRANSACTIONS ----
app.get('/recurring', authRequired, async (req, res) => {
  try {
    const recurrings = await RecurringTransaction.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ recurrings });
  } catch (error) {
    res.status(500).json({ message: 'Khong the lay danh sach giao dich dinh ky.' });
  }
});

app.post('/recurring', authRequired, async (req, res) => {
  try {
    const { amount, type, category, note, frequency, dayOfMonth } = req.body;
    if (!amount || !type || !category || !frequency) {
      return res.status(400).json({ message: 'Thieu thong tin giao dich dinh ky.' });
    }

    const nextRunDate = calcNextRunDate(frequency, dayOfMonth);

    const recurring = await RecurringTransaction.create({
      userId: req.user._id,
      amount,
      type,
      category,
      note: note || '',
      frequency,
      dayOfMonth: dayOfMonth || undefined,
      nextRunDate,
      isActive: true,
    });
    res.status(201).json({ recurring });
  } catch (error) {
    res.status(500).json({ message: 'Khong the tao giao dich dinh ky.' });
  }
});

app.put('/recurring/:id', authRequired, async (req, res) => {
  try {
    const recurring = await RecurringTransaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!recurring) return res.status(404).json({ message: 'Khong tim thay giao dich dinh ky.' });
    res.json({ recurring });
  } catch (error) {
    res.status(500).json({ message: 'Khong the cap nhat giao dich dinh ky.' });
  }
});

app.delete('/recurring/:id', authRequired, async (req, res) => {
  try {
    const recurring = await RecurringTransaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!recurring) return res.status(404).json({ message: 'Khong tim thay giao dich dinh ky.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Khong the xoa giao dich dinh ky.' });
  }
});

app.post('/recurring/process', authRequired, async (req, res) => {
  try {
    const now = new Date();
    const dueRecurrings = await RecurringTransaction.find({
      userId: req.user._id,
      isActive: true,
      nextRunDate: { $lte: now },
    });

    const createdTransactions = [];

    for (const rec of dueRecurrings) {
      // Format date as DD/MM/YYYY
      const d = new Date();
      const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

      const transaction = await Transaction.create({
        userId: rec.userId,
        amount: rec.amount,
        type: rec.type,
        category: rec.category,
        note: rec.note || '',
        date: dateStr,
      });
      createdTransactions.push(mapTransaction(transaction));

      // Advance nextRunDate
      rec.nextRunDate = advanceNextRunDate(rec.frequency, rec.dayOfMonth, rec.nextRunDate);
      await rec.save();

      // Create notification
      await Notification.create({
        userId: rec.userId,
        message: `Giao dich dinh ky "${rec.category}" ${rec.type === 'expense' ? 'chi' : 'thu'} ${Number(rec.amount).toLocaleString('vi-VN')}d da duoc xu ly tu dong.`,
        type: 'recurring',
      });
    }

    res.json({ processed: createdTransactions.length, transactions: createdTransactions });
  } catch (error) {
    console.error('Recurring process error:', error);
    res.status(500).json({ message: 'Khong the xu ly giao dich dinh ky.' });
  }
});

// ---- FINANCIAL HEALTH SCORE ----
app.get('/ai/health-score', authRequired, async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // Get last 3 months boundaries
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    // Build month keys for last 3 months
    const monthKeys = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    }

    // Get all transactions
    const allTxs = await Transaction.find({ userId });

    // Filter transactions from last 3 months
    function getMonthKey(dateStr) {
      const parts = String(dateStr).split('/');
      if (parts.length >= 3) {
        return `${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
      return null;
    }

    const recentTxs = allTxs.filter(t => {
      const mk = getMonthKey(t.date);
      return mk && monthKeys.includes(mk);
    });

    const totalIncome = recentTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = recentTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // Saving rate
    const saving_rate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;

    // Budget compliance: check current month budgets
    const currentMonthKey = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const budgets = await BudgetCategory.find({ userId, month: currentMonthKey });
    let budget_compliance = 1.0;
    if (budgets.length > 0) {
      const currentMonthTxs = recentTxs.filter(t => getMonthKey(t.date) === currentMonthKey && t.type === 'expense');
      let compliantCount = 0;
      for (const budget of budgets) {
        const spent = currentMonthTxs.filter(t => t.category === budget.categoryId).reduce((s, t) => s + t.amount, 0);
        if (spent <= budget.budgetAmount) compliantCount++;
      }
      budget_compliance = compliantCount / budgets.length;
    }

    // Saving goals
    const activeGoals = await SavingGoal.find({ userId, status: 'active' });
    const has_saving_goals = activeGoals.length > 0;

    // Balance positive
    const balance = totalIncome - totalExpense;
    const balance_positive = balance > 0;

    // Consistency: has transactions in all 3 months
    const txMonths = new Set(recentTxs.map(t => getMonthKey(t.date)).filter(Boolean));
    const consistency = monthKeys.every(mk => txMonths.has(mk));

    // Calculate score (base 300)
    let score = 300;

    // saving_rate: 0% = 0, 20%+ = 200 (linear capped)
    const savingRateScore = Math.min(200, Math.round((saving_rate / 0.2) * 200));
    score += Math.max(0, savingRateScore);

    // budget_compliance: 100% = 200
    const budgetScore = Math.round(budget_compliance * 200);
    score += budgetScore;

    // has saving goals: 100
    const goalsScore = has_saving_goals ? 100 : 0;
    score += goalsScore;

    // balance positive: 150
    const balanceScore = balance_positive ? 150 : 0;
    score += balanceScore;

    // consistency: 100
    const consistencyScore = consistency ? 100 : 0;
    score += consistencyScore;

    // Cap to 850
    score = Math.min(850, score);

    // Level
    let level = 'Kem';
    if (score >= 750) level = 'Xuat sac';
    else if (score >= 600) level = 'Tot';
    else if (score >= 450) level = 'Trung binh';

    // Tips
    const tips = [];
    if (saving_rate < 0.1) tips.push('Hay co gang tiet kiem it nhat 10% thu nhap moi thang.');
    if (saving_rate < 0.2) tips.push('Muc tiet kiem ly tuong la 20% thu nhap. Hay cat giam chi tieu khong can thiet.');
    if (budget_compliance < 0.8) tips.push('Mot so danh muc chi tieu da vuot ngan sach. Kiem soat chi tieu chat che hon.');
    if (!has_saving_goals) tips.push('Hay tao it nhat 1 hu tiet kiem de co muc tieu tai chinh ro rang.');
    if (!balance_positive) tips.push('Chi tieu cua ban dang vuot thu nhap. Can giam chi tieu gap!');
    if (!consistency) tips.push('Hay cap nhat giao dich deu dan moi thang de theo doi tai chinh tot hon.');
    if (tips.length === 0) tips.push('Tai chinh cua ban dang rat on. Hay tiep tuc duy tri!');

    res.json({
      score,
      level,
      details: {
        saving_rate: Math.round(saving_rate * 100),
        saving_rate_score: Math.max(0, savingRateScore),
        budget_compliance: Math.round(budget_compliance * 100),
        budget_compliance_score: budgetScore,
        has_saving_goals,
        goals_score: goalsScore,
        balance_positive,
        balance_score: balanceScore,
        consistency,
        consistency_score: consistencyScore,
        totalIncome,
        totalExpense,
        balance,
      },
      tips,
    });
  } catch (error) {
    console.error('Health score error:', error);
    res.status(500).json({ message: 'Khong the tinh diem suc khoe tai chinh.' });
  }
});

// ---- OCR INVOICE ----
app.post('/transactions/ocr', authRequired, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: 'Thieu du lieu anh.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback mock data khi chưa có API key
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      return res.json({
        amount: 150000,
        category: 'food',
        note: 'Hoa don nha hang',
        date: `${dd}/${mm}/${yyyy}`,
        items: [{ name: 'Mon an', price: 150000 }],
      });
    }

    const prompt = `Ban la mot he thong OCR chuyen phan tich hoa don mua sam. Phan tich hinh anh hoa don nay va tra ve JSON voi dinh dang:
{
  "amount": <tong so tien hop dong, so nguyen, don vi VND>,
  "category": <mot trong cac gia tri: food, transport, shopping, health, entertainment, education, home, other>,
  "note": <ten cua hang hoac mo ta ngan gon>,
  "date": <ngay hoa don dinh dang DD/MM/YYYY, neu khong co dung ngay hom nay>,
  "items": [{"name": "<ten mon>", "price": <gia tien so nguyen>}]
}
Chi tra ve JSON thuan tuy, khong them bat ky giai thich hay markdown nao.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
          ]
        }]
      })
    });

    if (!response.ok) {
      throw new Error('Gemini API error');
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and provide defaults
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    res.json({
      amount: Number(parsed.amount) || 0,
      category: parsed.category || 'other',
      note: parsed.note || 'Hoa don mua sam',
      date: parsed.date || `${dd}/${mm}/${yyyy}`,
      items: parsed.items || [],
    });
  } catch (error) {
    console.error('OCR Error:', error);
    // Fallback khi lỗi
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    res.json({
      amount: 0,
      category: 'other',
      note: 'Vui long kiem tra lai',
      date: `${dd}/${mm}/${yyyy}`,
      items: [],
    });
  }
});

// ---- START ----
async function start() {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI environment variable.');
  }

  await mongoose.connect(MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
