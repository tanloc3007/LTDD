// ===== LOGIN PAGE LOGIC =====

/**
 * Hiện/ẩn mật khẩu
 * @param {string} id - ID của input
 * @param {HTMLElement} btn - Nút toggle
 */
function togglePassword(id, btn) {
  const input = document.getElementById(id);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
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
 * Xử lý đăng nhập: validate rồi chuyển sang trang chủ
 */
function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const btn      = document.getElementById('btn-login');

  if (!email || !password) {
    showToast('⚠️ Vui lòng nhập đầy đủ thông tin!');
    return;
  }
  if (!email.includes('@')) {
    showToast('⚠️ Email không hợp lệ!');
    return;
  }
  if (password.length < 6) {
    showToast('⚠️ Mật khẩu phải có ít nhất 6 ký tự!');
    return;
  }

  // Loading state
  btn.textContent = '⏳ Đang đăng nhập...';
  btn.disabled = true;
  btn.style.opacity = '0.8';

  setTimeout(() => {
    showToast('✅ Đăng nhập thành công!');
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 1000);
  }, 1200);
}

/**
 * Khởi tạo sự kiện khi DOM sẵn sàng
 */
document.addEventListener('DOMContentLoaded', () => {
  // Nhấn Enter ở ô mật khẩu để đăng nhập
  const pwInput = document.getElementById('login-password');
  if (pwInput) {
    pwInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }

  // Nhấn Enter ở ô email để chuyển sang mật khẩu
  const emailInput = document.getElementById('login-email');
  if (emailInput) {
    emailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('login-password').focus();
      }
    });
  }
});
