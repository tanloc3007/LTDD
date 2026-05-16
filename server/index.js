const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config({ path: __dirname + '/.env' });

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const CLOUDINARY_AVATAR_FOLDER = process.env.CLOUDINARY_AVATAR_FOLDER || 'financial-management/avatars';

app.use(cors());
app.use(express.json({ limit: '15mb' }));

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:        { type: String, default: '', trim: true },
    passwordHash: { type: String, default: null },
    // Social login
    provider:     { type: String, enum: ['local', 'google', 'facebook'], default: 'local' },
    providerId:   { type: String, default: null },
    avatar:       { type: String, default: null },
    avatarPublicId: { type: String, default: null },
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

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const BudgetCategory = mongoose.model('BudgetCategory', budgetCategorySchema);
const Notification = mongoose.model('Notification', notificationSchema);
const GlobalLimit = mongoose.model('GlobalLimit', globalLimitSchema);
const Category = mongoose.model('Category', categorySchema);

function createToken(user) {
  return jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
}

function sanitizeUser(user) {
  return {
    id:       user._id.toString(),
    name:     user.name,
    email:    user.email,
    phone:    user.phone || '',
    avatar:   user.avatar || null,
    provider: user.provider || 'local',
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

function isCloudinaryConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

async function uploadAvatarToCloudinary({ avatarBase64, avatarMimeType, userId }) {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured.');
  }

  const mimeType = avatarMimeType || 'image/jpeg';
  const uploadResult = await cloudinary.uploader.upload(`data:${mimeType};base64,${avatarBase64}`, {
    folder: CLOUDINARY_AVATAR_FOLDER,
    resource_type: 'image',
    overwrite: false,
    public_id: `avatar_${userId}_${Date.now()}`,
  });

  return {
    secureUrl: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  };
}

function extractCloudinaryPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;

  const uploadMarker = '/upload/';
  const markerIndex = url.indexOf(uploadMarker);
  if (markerIndex === -1) return null;

  let publicPath = url.slice(markerIndex + uploadMarker.length);
  publicPath = publicPath.replace(/^v\d+\//, '');
  publicPath = publicPath.replace(/\.[^/.]+$/, '');

  return publicPath || null;
}

async function deleteAvatarFromCloudinary(publicIdOrUrl) {
  const publicId =
    typeof publicIdOrUrl === 'string' && !publicIdOrUrl.includes('res.cloudinary.com')
      ? publicIdOrUrl
      : extractCloudinaryPublicIdFromUrl(publicIdOrUrl);
  if (!publicId || !isCloudinaryConfigured()) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });

    if (result.result !== 'ok' && result.result !== 'not found') {
      console.warn('Unexpected Cloudinary delete result:', publicId, result);
    }
  } catch (error) {
    console.error('Delete old avatar error:', error);
  }
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

// ---- SOCIAL LOGIN (Google / Facebook) ----
const GOOGLE_WEB_CLIENT_ID = '769715173800-apeqnirv8pi0c26j709o0d973tim15on.apps.googleusercontent.com';

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

// ---- CATEGORIES ----
app.get('/categories', authRequired, async (req, res) => {
  const categories = await Category.find({ userId: req.user._id }).sort({ createdAt: 1 });
  res.json({ categories });
});

app.post('/categories', authRequired, async (req, res) => {
  try {
    const { label, icon, color, type } = req.body;
    if (!label) return res.status(400).json({ message: 'Tên danh mục không được để trống.' });
    
    const category = await Category.create({
      userId: req.user._id,
      label,
      icon: icon || 'apps',
      color: color || '#8892A4',
      type: type || 'expense',
    });
    res.status(201).json({ category });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo danh mục.' });
  }
});

// ---- USER PROFILE & SETTINGS ----
app.put('/user/profile', authRequired, async (req, res) => {
  try {
    const { name, avatarBase64, avatarMimeType } = req.body || {};
    const update = {};
    const previousAvatar = req.user.avatar || null;
    const previousAvatarPublicId =
      req.user.avatarPublicId || extractCloudinaryPublicIdFromUrl(previousAvatar);
    if (typeof name === 'string' && !name.trim()) {
      return res.status(400).json({ message: 'Tên không được để trống.' });
    }
    if (typeof name === 'string' && name.trim()) {
      update.name = name.trim();
    }
    if (avatarBase64) {
      const uploadedAvatar = await uploadAvatarToCloudinary({
        avatarBase64,
        avatarMimeType,
        userId: req.user._id.toString(),
      });
      update.avatar = uploadedAvatar.secureUrl;
      update.avatarPublicId = uploadedAvatar.publicId;
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: 'Khong co thong tin nao de cap nhat.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      update,
      { new: true }
    );
    if (avatarBase64 && previousAvatar && previousAvatar !== user.avatar) {
      await deleteAvatarFromCloudinary(previousAvatarPublicId || previousAvatar);
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error('Update profile error:', error);
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

// ---- AI BUDGET SUGGESTIONS ----
app.post('/ai-budget-suggestions', authRequired, async (req, res) => {
  try {
    const { income, expenses, currentBudgets } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      return res.status(500).json({ message: 'GROQ_API_KEY chưa được thiết lập trên server.' });
    }

    const systemPrompt = `
      Bạn là chuyên gia tư vấn tài chính cá nhân. Nhiệm vụ của bạn là đưa ra gợi ý ngân sách chi tiêu.
      CHỈ TRẢ VỀ DỮ LIỆU DƯỚI DẠNG MẢNG JSON. TUYỆT ĐỐI KHÔNG GIẢI THÍCH, KHÔNG CHÀO HỎI.
      
      Định dạng mảng JSON:
      [
        {"id": "suggest_1", "label": "Ăn uống", "suggestion": "2.000.000đ", "icon": "restaurant", "color": "#FF6B35"},
        {"id": "suggest_2", "label": "Mua sắm", "suggestion": "1.500.000đ", "icon": "cart", "color": "#FF9500"},
        {"id": "suggest_3", "label": "Di chuyển", "suggestion": "1.000.000đ", "icon": "car", "color": "#178BFF"}
      ]
      
      Quy tắc:
      - "id" là duy nhất.
      - "label" là tên danh mục.
      - "suggestion" là số tiền kèm đ (vd: 500.000đ).
      - "icon" là tên icon từ Ionicons (restaurant, cart, car, leaf, play-circle, receipt, book, brush, body, home, heart, wallet).
      - "color" là mã màu HEX.
    `;

    const userPrompt = `
      Dữ liệu người dùng:
      - Thu nhập: ${income}
      - Chi tiêu: ${expenses}
      - Ngân sách hiện tại: ${currentBudgets || 'Chưa có'}
      
      Hãy gợi ý 3 mục ngân sách phù hợp nhất. Chỉ trả về JSON.
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

    if (!response.ok) return res.status(500).json({ message: 'Lỗi API AI.' });

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
      res.status(500).json({ message: 'AI trả về định dạng không hợp lệ.' });
    }
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra.' });
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
