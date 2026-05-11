// ===== REGISTER PAGE LOGIC =====

/**
 * Hiện/ẩn mật khẩu
 * @param {string} id - ID của input
 * @param {HTMLElement} btn - Nút toggle
 */
function togglePassword(id, btn) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁️' : '🙈';
}

/**
 * Hiển thị thông báo toast
 * @param {string} msg - Nội dung thông báo
 */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
  }, 2500);
}

/**
 * Kiểm tra độ mạnh của mật khẩu và hiển thị thanh trạng thái
 * @param {string} pw - Mật khẩu cần kiểm tra
 */
function checkStrength(pw) {
  const fill  = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');

  let score = 0;
  if (pw.length >= 6)            score++;
  if (pw.length >= 10)           score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { w: '0%',   color: '#ccc',     text: 'Nhập mật khẩu để kiểm tra độ mạnh' },
    { w: '20%',  color: '#F5365C', text: '🔴 Rất yếu' },
    { w: '40%',  color: '#FF8C00', text: '🟠 Yếu' },
    { w: '60%',  color: '#FFC107', text: '🟡 Trung bình' },
    { w: '80%',  color: '#2DCE89', text: '🟢 Mạnh' },
    { w: '100%', color: '#00C851', text: '💪 Rất mạnh' },
  ];

  const level = levels[pw.length === 0 ? 0 : Math.min(score, 5)];
  fill.style.width      = level.w;
  fill.style.background = level.color;
  label.textContent     = level.text;
  label.style.color     = level.color;
}

/**
 * Kích hoạt upload ảnh đại diện
 */
function triggerAvatarUpload() {
  document.getElementById('avatar-input').click();
}

/**
 * Xem trước ảnh đại diện đã chọn
 * @param {HTMLInputElement} input - Input file
 */
function previewAvatar(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('avatar-preview');
      preview.innerHTML = `
        <img src="${e.target.result}"
          style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
        <div class="avatar-overlay">Đổi ảnh</div>
      `;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

/**
 * Validate toàn bộ form và xử lý đăng ký
 */
function handleRegister() {
  const name    = document.getElementById('reg-name').value.trim();
  const email   = document.getElementById('reg-email').value.trim();
  const phone   = document.getElementById('reg-phone').value.trim();
  const pw      = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const terms   = document.getElementById('terms-check').checked;
  const btn     = document.getElementById('btn-register');

  // Validate từng trường
  if (!name)                        return showToast('⚠️ Vui lòng nhập họ và tên!');
  if (!email || !email.includes('@')) return showToast('⚠️ Email không hợp lệ!');
  if (!phone || phone.length < 9)   return showToast('⚠️ Số điện thoại không hợp lệ!');
  if (pw.length < 6)                return showToast('⚠️ Mật khẩu phải có ít nhất 6 ký tự!');
  if (pw !== confirm)               return showToast('⚠️ Mật khẩu xác nhận không khớp!');
  if (!terms)                       return showToast('⚠️ Vui lòng đồng ý với điều khoản!');

  // Loading state
  btn.textContent  = '⏳ Đang tạo tài khoản...';
  btn.disabled     = true;
  btn.style.opacity = '0.8';

  // Animate step dots
  document.getElementById('dot2').classList.add('active');
  setTimeout(() => document.getElementById('dot3').classList.add('active'), 600);

  setTimeout(() => {
    showToast('🎉 Đăng ký thành công! Chào mừng bạn!');
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 1200);
  }, 1500);
}

/**
 * Khởi tạo các sự kiện khi DOM sẵn sàng
 */
document.addEventListener('DOMContentLoaded', () => {
  // Lắng nghe sự kiện nhập mật khẩu để kiểm tra độ mạnh
  const pwInput = document.getElementById('reg-password');
  if (pwInput) {
    pwInput.addEventListener('input', () => checkStrength(pwInput.value));
  }

  // Nhấn Enter ở mỗi field để focus field tiếp theo
  const fields = ['reg-name', 'reg-email', 'reg-phone', 'reg-password', 'reg-confirm'];
  fields.forEach((id, index) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          if (index < fields.length - 1) {
            document.getElementById(fields[index + 1]).focus();
          } else {
            handleRegister();
          }
        }
      });
    }
  });
});
