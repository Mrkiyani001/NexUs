# Frontend Specification Document

This document outlines the requirements, pages, and API integrations needed for the frontend application of the **AuthApi Project**.

## 1. Technology & Setup
- **Stack**: Vanilla HTML, CSS, and JavaScript.
- **Styling**: Plain CSS or Bootstrap/Tailwind (CDN).
- **Authentication**:
  - Use `localStorage.setItem('token', token)` to save the JWT on login.
  - Use `fetch()` for all API calls.
  - **Crucial**: You must manually add the header to every request:
    ```javascript
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    ```
- **Routing**: Simple multi-page application (e.g., `login.html`, `dashboard.html`). Check for token on page load; if missing, redirect to `login.html`.

## 2. Public Pages

### Login Page
- **Route**: `/login`
- **Fields**:
  - `email` (Type: Email, Required)
  - `password` (Type: Password, Required)
- **API Endpoint**: `POST /api/login`
- **Action**: On success, save token and redirect to Dashboard.

### Register Page
- **Route**: `/register`
- **Fields**:
  - `name` (Type: Text, Required)
  - `email` (Type: Email, Required)
  - `password` (Type: Password, Required, Min: 6 chars)
  - `password_confirmation` (Type: Password, Required, Must match password)
- **API Endpoint**: `POST /api/register`

## 3. User Dashboard (Protected)

### Navigation Bar
- Links: Home, My Profile, Create Post, Logout.
- **Logout Action**: Call `POST /api/logout` and clear local token.

### Home Feed
- **Route**: `/` or `/feed`
- **Display**: List of approved posts.
- **API Endpoint**: `GET /api/get_all_posts`
- **Data to Show**:
  - Post Title (`title`)
  - Author Name (`user.name`)
  - Body Content (Truncated)
  - Attachments (Images/Videos)

### Create Post
- **Route**: `/posts/create`
- **Fields**:
  - `title` (Type: Text, Required)
  - `body` (Type: Textarea/Rich Text, Required)
  - `attachments[]` (Type: File Upload, Multiple, Optional)
    - *Support images (jpg, png) and docs (pdf).*
- **API Endpoint**: `POST /api/create_post`
- **Note**: Use `FormData` to send files.

### View Post Detail
- **Route**: `/posts/:id`
- **Display**: Full post content, attachments.
- **Interactions**:
  - **Comments Section**: List comments and form to add new comment.
    - **API**: `POST /api/create_comment` (Fields: `post_id`, `comment`)
    - **API**: `POST /api/get_comment` (to list comments)
  - **Reactions**: Like/Dislike buttons.
    - **API**: `POST /api/add_reaction_to_post`

## 4. Admin Dashboard (Role: Admin)

### User Management
- **Route**: `/admin/users`
- **List**: All users (`GET /api/getallusers`).
- **Actions**:
  - Edit User (`PUT /api/updateUser`)
  - Delete User (`DELETE /api/delete_user`)
  - Assign Role (`POST /api/role/assign_role`)

### Moderation Queue (Pending Posts)
> **Note to Backend Dev**: Ensure routes for `PendingPosts`, `Approved`, and `Rejected` are added to `api.php`.
- **Route**: `/admin/moderation`
- **API Endpoint**: `GET /api/pending_posts` (Proposed)
- **Display**: List of posts with `status: pending`.
- **Actions**:
  - **Approve**: Call `POST /api/approve_post` (Proposed)
  - **Reject**: Call `POST /api/reject_post` (Proposed)

## 5. API Reference Summary

| Feature | Method | Endpoint | Payload |
| :--- | :--- | :--- | :--- |
| **Login** | POST | `/api/login` | `{email, password}` |
| **Register** | POST | `/api/register` | `{name, email, password, password_confirmation}` |
| **Create Post** | POST | `/api/create_post` | `FormData{title, body, attachments[]}` |
| **Get Posts** | GET | `/api/get_all_posts` | - |
| **Delete Post** | DELETE | `/api/delete_post` | `{id}` |

## 6. Error Handling
- **401 Unauthorized**: Redirect user to Login.
- **422 Validation Error**: Display error messages below specific fields.
- **500 Server Error**: Show a generic "Something went wrong" toast notification.
