# AuthApi Project

A robust Laravel-based API application featuring JWT Authentication, Role-based Access Control (RBAC), and AI-powered Content Moderation.

## 🚀 Features

- **Authentication**: Secure JWT (JSON Web Token) authentication using `tymon/jwt-auth`.
- **Authorization**: Role and Permission management using `spatie/laravel-permission`.
- **Content Moderation**:
  - Automated keyword filtering using `hootlex/laravel-moderation`.
  - AI-powered moderation (OpenAI/Gemini) integration.
  - Automated flagging and approval workflows.
- **Post Management**: CRUD operations for Posts, Comments, and Replies.
- **Job Queues**: Background processing for moderation and other tasks.

## 🛠 Tech Stack

- **Framework**: Laravel 11/12
- **PHP**: ^8.2
- **Database**: MySQL / SQLite
- **Cache/Queue**: Redis (via `predis/predis`)
- **External Services**: OpenAI API / Google Gemini API

## ⚙️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AuthApi-project
   ```

2. **Install Dependencies**
   ```bash
   composer install
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   php artisan key:generate
   php artisan jwt:secret
   ```
   *Configure your database and API keys (OPENAI_API_KEY, etc.) in the `.env` file.*

4. **Database Setup**
   ```bash
   php artisan migrate --seed
   ```

5. **Run the Application**
   ```bash
   php artisan serve
   ```

6. **Queue Worker (Required for Moderation)**
   ```bash
   php artisan queue:work
   ```

## 📚 API Types

- **Public**: View approved posts and comments.
- **Auth**: Login, Register, Refresh Token.
- **User**: CRUD operations for own posts.
- **Admin**: Approve/Reject posts, User management.

## 📝 Documentation

To generate full API documentation (endpoints, parameters, responses), we recommend using **Scribe**.

### Fast Track to API Docs:
1. Install Scribe: `composer require --dev knuckleswtf/scribe`
2. Publish Config: `php artisan vendor:publish --tag=scribe-config`
3. Generate: `php artisan scribe:generate`
4. Visit: `http://localhost:8000/docs`
