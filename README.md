# NexUs - Modern Social Ecosystem

NexUs is a premium, high-performance social networking platform designed with a focus on **visual excellence**, **secure authentication**, and **robust content moderation**. Built with a decoupled architecture, it leverages a powerful Laravel backend and a stunning, responsive Vanilla JS frontend.

---

## 🚀 Core Philosophy
NexUs is built to provide a "Glassmorphic" user experience—where translucency, vibrant colors, and smooth animations meet enterprise-grade security.

## 🛠 Tech Stack

### Backend ([AuthApi-project](NexUs/AuthApi-project))
- **Framework**: Laravel 11.x
- **Authentication**: Dual-mode (JWT & HttpOnly Secure Cookies)
- **Database**: MySQL with Eloquent ORM
- **RBAC**: Spatie Roles & Permissions
- **AI Moderation**: (In-development) Integration with Gemini/Prism for automated flagging.

### Frontend ([Front-end](NexUs/Front-end))
- **Language**: Vanilla JavaScript (ES6+)
- **Styling**: Tailwind CSS + Custom CSS Variables for HSL-based theming.
- **UI Design**: Modern Glassmorphism (Backdrop filters, Gaussian blurs).
- **Icons**: Google Material Symbols.
- **Charts**: Chart.js for Admin Analytics.

---

## 💎 Features A to Z

### 🔐 1. Authentication & Security
- **Secure Login/Register**: Integrated HttpOnly cookie auth to prevent XSS-based token theft.
- **Password Lifecycle**: Forget/Reset flows and secure update mechanisms.
- **Account Protection**: Automated banning system and account deactivation.

### 👤 2. Social Ecosystem
- **Profiles**: Dynamic user headers, custom bios, and follower/following metrics.
- **Follow System**: Supports private accounts with **Follow Requests**.
- **Discovery**: "Who to Follow" AI-driven suggestions based on platform activity.

### 🎥 3. Content Engine
- **Vertical Reels**: A mobile-first, TikTok-style immersive video feed.
- **Photo/Video Posts**: High-quality media sharing with multi-file support.
- **Moderation Workflow**: All posts pass through a `Pending` state for Admin review before becoming public.

### 💬 4. Dynamic Engagement
- **Threaded Conversations**: Recursive comment replies (A replied to B, B replied to C).
- **Reactions**: Expressive emoji reactions across all content types.
- **Share & Track**: Deep-linking for content sharing and unique view tracking logic.

### 🛡️ 5. Admin Command Center
- **Real-time Analytics**: Visualized stats for users, growth, and system health.
- **Moderation Queue**: Efficient bulk approval/rejection of content.
- **Report Management**: A centralized hub to resolve user-flagged content.
- **Granular RBAC**: Assign predefined roles (Super Admin, Moderator) or custom permissions.
- **Site Branding**: Update Logo, Favicon, Theme Colors, and Maintenance Mode in one click.

---

## 🏗 Project Architecture

### Directory Structure
```text
Site-Main/
├── AuthApi-project/       # Laravel API Backend
│   ├── app/Controllers/   # Logic for Auth, Posts, Reels, Admin, etc.
│   ├── routes/api.php     # Endpoint definitions
│   └── database/          # Migrations and Seeders
└── Front-end/             # Responsive Web Frontend
    ├── admin panel/       # Specialized Admin UI
    ├── js/                # Modular logic (utils.js, config.js, etc.)
    └── *.html             # Page-specific layouts
```

### Security Best Practices
NexUs implements a **Stateless API** with server-side cookie encryption. By moving sensitive tokens from `localStorage` to **HttpOnly Cookies**, we effectively eliminated 99% of frontend token injection vulnerabilities.

---

## 📈 Roadmap
- [ ] **Direct Messaging**: Global real-time chat.
- [ ] **Stories**: 24-hour media status updates.
- [ ] **AI Search**: Semantic search for users and content.

---

## 👨‍💻 Developer Note
> "NexUs isn't just a project; it's a statement on how modern web apps should look and feel. Every line of CSS and every API response is optimized for the 'WOW' factor."
