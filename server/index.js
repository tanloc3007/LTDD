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

app.use(cors());
app.use(express.json());

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
    type: { type: String, enum: ['expense', 'income', 'budget_warning', 'budget_over', 'other'], default: 'other' },
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

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const BudgetCategory = mongoose.model('BudgetCategory', budgetCategorySchema);
const Notification = mongoose.model('Notification', notificationSchema);
const GlobalLimit = mongoose.model('GlobalLimit', globalLimitSchema);

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

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Chưa đăng nhập.' });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: 'Tài khoản không tồn tại.' });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ.' });
  }
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: 'Email này đã được đăng ký.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, passwordHash });
    const token = createToken(user);

    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể đăng ký tài khoản.' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    return res.json({ user: sanitizeUser(user), token: createToken(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể đăng nhập.' });
  }
});

app.get('/transactions', authRequired, async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ transactions: transactions.map(mapTransaction) });
});

app.post('/transactions', authRequired, async (req, res) => {
  try {
    const { amount, type, category, note, date } = req.body;
    if (!amount || !type || !category || !date) {
      return res.status(400).json({ message: 'Thiếu thông tin giao dịch.' });
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
          await Notification.create({ userId: req.user._id, message: `⚠️ Vượt ngân sách danh mục "${budget.label}" ${Number(total - budget.budgetAmount).toLocaleString('vi-VN')}đ!`, type: 'budget_over' });
        } else if (total / budget.budgetAmount >= 0.8) {
          await Notification.create({ userId: req.user._id, message: `⚡ Đã dùng ${Math.round(total / budget.budgetAmount * 100)}% ngân sách "${budget.label}"`, type: 'budget_warning' });
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
          await Notification.create({ userId: req.user._id, message: `🚨 CẢNH BÁO ĐỎ: Tổng chi tiêu đã vượt quá 120% hạn mức tháng! (${Number(allTotal - globalLimit.limitAmount).toLocaleString('vi-VN')}đ)`, type: 'budget_over' });
        } else if (allTotal > globalLimit.limitAmount) {
          await Notification.create({ userId: req.user._id, message: `⚠️ Vượt hạn mức tổng tháng này! (${Number(allTotal - globalLimit.limitAmount).toLocaleString('vi-VN')}đ)`, type: 'budget_over' });
        } else if (allTotal / globalLimit.limitAmount >= 0.8) {
          await Notification.create({ userId: req.user._id, message: `⚡ Cảnh báo: Tổng chi tiêu đã đạt ${Math.round(allTotal / globalLimit.limitAmount * 100)}% hạn mức tháng`, type: 'budget_warning' });
        }
      }
    }

    res.status(201).json({ transaction: mapTransaction(transaction) });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu giao dịch.' });
  }
});

app.put('/transactions/:id', authRequired, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!transaction) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
    res.json({ transaction: mapTransaction(transaction) });
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật giao dịch.' });
  }
});

app.delete('/transactions/:id', authRequired, async (req, res) => {
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!transaction) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
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
      return res.status(400).json({ message: 'Thiếu thông tin hạn mức.' });
    }
    const limit = await GlobalLimit.findOneAndUpdate(
      { userId: req.user._id, month },
      { limitAmount },
      { new: true, upsert: true }
    );

    // Check if total expense exceeds this new limit
    const allTxs = await Transaction.find({ userId: req.user._id, type: 'expense' });
    const allTotal = allTxs.filter(t => {
      const tParts = String(t.date).split('/');
      const tMonthKey = tParts.length >= 3 ? `${tParts[1].padStart(2, '0')}/${tParts[2]}` : month;
      return tMonthKey === month;
    }).reduce((s, t) => s + t.amount, 0);

    if (allTotal > limit.limitAmount * 1.2) {
      await Notification.create({ userId: req.user._id, message: `🚨 CẢNH BÁO ĐỎ: Tổng chi tiêu đã vượt quá 120% hạn mức tháng vừa thiết lập! (${Number(allTotal - limit.limitAmount).toLocaleString('vi-VN')}đ)`, type: 'budget_over' });
    } else if (allTotal > limit.limitAmount) {
      await Notification.create({ userId: req.user._id, message: `⚠️ Vượt hạn mức tổng tháng vừa thiết lập! (${Number(allTotal - limit.limitAmount).toLocaleString('vi-VN')}đ)`, type: 'budget_over' });
    } else if (allTotal / limit.limitAmount >= 0.8) {
      await Notification.create({ userId: req.user._id, message: `⚡ Cảnh báo: Tổng chi tiêu hiện tại đã đạt ${Math.round(allTotal / limit.limitAmount * 100)}% hạn mức tháng vừa thiết lập`, type: 'budget_warning' });
    }

    res.status(200).json({ limit });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo hạn mức.' });
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
      return res.status(400).json({ message: 'Thiếu thông tin ngân sách.' });
    }
    const exists = await BudgetCategory.findOne({ userId: req.user._id, categoryId, month });
    if (exists) {
      return res.status(409).json({ message: 'Danh mục này đã có ngân sách trong tháng.' });
    }
    const budget = await BudgetCategory.create({ userId: req.user._id, categoryId, label, icon, color, budgetAmount, month });
    res.status(201).json({ budget });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo ngân sách.' });
  }
});

app.put('/budgets/:id', authRequired, async (req, res) => {
  try {
    const budget = await BudgetCategory.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!budget) return res.status(404).json({ message: 'Không tìm thấy ngân sách.' });
    res.json({ budget });
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật ngân sách.' });
  }
});

app.delete('/budgets/:id', authRequired, async (req, res) => {
  const budget = await BudgetCategory.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!budget) return res.status(404).json({ message: 'Không tìm thấy ngân sách.' });
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

// ---- USER PROFILE & SETTINGS ----
app.put('/user/profile', authRequired, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Tên không được để trống.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim() },
      { new: true }
    );
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật hồ sơ.' });
  }
});

app.put('/auth/change-password', authRequired, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mới.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu cũ không chính xác.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    res.json({ ok: true, message: 'Đổi mật khẩu thành công.' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể đổi mật khẩu.' });
  }
});

app.delete('/user/data', authRequired, async (req, res) => {
  try {
    const userId = req.user._id;
    await Transaction.deleteMany({ userId });
    await BudgetCategory.deleteMany({ userId });
    await GlobalLimit.deleteMany({ userId });
    await Notification.deleteMany({ userId });
    
    // Add a system note
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateStr = `${day}/${month}/${year}`;

    await Transaction.create({
      userId,
      amount: 0,
      type: 'expense',
      category: 'other',
      note: 'Đã xóa toàn bộ dữ liệu',
      date: dateStr
    });

    res.json({ ok: true, message: 'Đã xóa toàn bộ dữ liệu.' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể xóa dữ liệu.' });
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
    res.status(500).json({ message: 'Không thể xuất dữ liệu.' });
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

    res.json({ ok: true, message: 'Phục hồi dữ liệu thành công.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Không thể phục hồi dữ liệu.' });
  }
});

// ---- AI CHAT ----
app.post('/ai-chat', authRequired, async (req, res) => {
  try {
    const { input, contextData } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      return res.status(500).json({ message: 'GROQ_API_KEY chưa được thiết lập trên server.' });
    }

    const promptContext = `
      Ban la mot tro ly tai chinh thong minh cua ung dung MoMo Finance.
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
      return res.status(500).json({ message: 'Lỗi từ Groq API.' });
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;

    res.json({ text: responseText || 'Xin loi, toi chua co cau tra loi phu hop luc nay.' });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ message: 'Co loi xay ra khi ket noi voi AI.' });
  }
});

app.delete('/notifications/:id', authRequired, async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  res.json({ ok: true });
});

// Hook: auto-create notification when transaction added is merged into POST /transactions

async function start() {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in server/.env');
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
