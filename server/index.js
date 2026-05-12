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

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

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
