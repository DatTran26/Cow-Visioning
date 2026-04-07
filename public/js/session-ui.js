// session-ui.js — Session DOM manipulation
// Depends on: AppSession being available (session.js loads before app.js)
// Exposed as window.SessionUI = { applyAuthUi, setVisibility, markSessionReady }
window.SessionUI = (() => {
    function setVisibility(element, shouldShow, displayValue = '') {
        if (!element) return;
        element.hidden = !shouldShow;
        element.style.display = shouldShow ? displayValue : 'none';
    }

    function markSessionReady() {
        document.body.classList.remove('app-session-pending');
        document.body.classList.add('app-session-ready');
    }

    function applyAuthUi(currentUser, getLoginUrl, getRegisterUrl) {
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userBadge = document.getElementById('topnav-user');
        const primaryAction = document.getElementById('home-primary-action');
        const secondaryAction = document.getElementById('home-secondary-action');
        const ctaTitle = document.getElementById('home-cta-title');
        const ctaCopy = document.getElementById('home-cta-copy');
        const ctaNote = document.getElementById('home-cta-note');
        const adminNav = document.getElementById('admin-nav');
        const adminNavSep = document.getElementById('admin-nav-sep');

        const isAuthenticated = Boolean(currentUser);
        const isAdmin = currentUser?.role === 'admin';

        document.body.classList.toggle('app-authenticated', isAuthenticated);
        document.body.classList.toggle('app-guest', !isAuthenticated);

        if (loginBtn) {
            loginBtn.href = getLoginUrl();
            setVisibility(loginBtn, !isAuthenticated, 'inline-flex');
        }
        if (registerBtn) {
            registerBtn.href = getRegisterUrl();
            setVisibility(registerBtn, !isAuthenticated, 'inline-flex');
        }
        if (logoutBtn) setVisibility(logoutBtn, isAuthenticated, 'inline-flex');

        if (userBadge) {
            userBadge.textContent = isAuthenticated ? `Xin chào, ${currentUser.username}` : '';
            setVisibility(userBadge, isAuthenticated, 'inline-flex');
        }

        if (primaryAction && secondaryAction && ctaTitle && ctaCopy && ctaNote) {
            if (isAuthenticated) {
                ctaTitle.textContent = 'Tài khoản đã sẵn sàng';
                ctaCopy.textContent = 'Bạn có thể mở ngay khu thu thập ảnh, dùng camera trực tiếp, xem lại thư viện dữ liệu và truy cập khu quản trị nếu được cấp quyền.';
                ctaNote.textContent = 'Phiên đăng nhập đang hoạt động. Hệ thống sẽ giữ nguyên trạng thái người dùng khi bạn chuyển qua các khu làm việc.';
                primaryAction.textContent = 'Mở khu thu thập ảnh';
                primaryAction.href = '/?tab=thu-thap';
                secondaryAction.textContent = 'Mở thư viện dữ liệu';
                secondaryAction.href = '/?tab=gallery';
            } else {
                ctaTitle.textContent = 'Cùng xây dựng Dataset';
                ctaCopy.textContent = 'Đăng nhập để theo dõi lịch sử đóng góp, được ghi danh, và tham gia cộng đồng. Bạn vẫn có thể trải nghiệm AI thu thập ảnh ẩn danh nếu muốn.';
                ctaNote.textContent = 'Ảnh ẩn danh được chia sẻ vào thư viện cộng đồng chung.';
                primaryAction.textContent = 'Trải nghiệm Upload (Khách)';
                primaryAction.href = '/?tab=thu-thap';
                secondaryAction.textContent = 'Mở Thư viện (Khách)';
                secondaryAction.href = '/?tab=gallery';
            }
        }

        setVisibility(adminNav, isAdmin, '');
        setVisibility(adminNavSep, isAdmin, '');
        markSessionReady();
    }

    return { applyAuthUi, setVisibility, markSessionReady };
})();
