# 🎯 AssetFlow  
### Modern IT Asset & Subscription Management Platform

---

## Overview

**AssetFlow** is a modular IT Asset and Resource Management platform designed to help organizations track physical assets, manage digital subscriptions, control employee allocations, and centralize operational oversight within a single system.

The platform combines structured data modeling, controlled transfer workflows, and administrative configuration tools with a modern, interactive interface.

AssetFlow is built for internal IT departments, growing companies, and organizations that require clear asset visibility and accountability.

---

## Technology Stack

**Frontend**
- React
- TailwindCSS
- Framer Motion

**Backend**
- FastAPI (Python)
- Async MongoDB driver (Motor)
- JWT-based authentication

**Database**
- MongoDB (Atlas compatible)

**Mobile**
- React Native (Expo)
- Zustand
- React Navigation v6

---

# Core Modules

---

## 1️⃣ Dashboard

The dashboard provides real-time operational insight into organizational assets.

### Displays

- Total Employees
- Total Assets
- Assigned Assets
- Assets in Inventory
- Assignment status breakdown
- Assets by type
- Distribution overview
- Adaptive metric widgets

Dashboard components automatically adjust based on available system data.

---

## 2️⃣ Asset Management

Comprehensive lifecycle tracking for physical IT equipment.

### Features

- Unlimited asset types (Laptop, Mobile, Tablet, etc.)
- Dynamic custom field system per asset type
- Unique asset tag enforcement
- Backend duplicate prevention
- Asset status tracking:
  - Active
  - Under Repair
  - Retired
- Warranty expiry detection with visual indicators
- Asset image uploads
- Clean model-number–focused detail view
- Employee assignment linking

All assets follow structured schemas defined per asset type.

---

## 3️⃣ Employee Management

Structured employee profiles with asset mapping.

### Features

- Unique employee ID system
- Department and designation tracking
- Assigned asset overview
- Direct navigation between employee and asset records
- Individual employee export capability
- Assignment updates via structured transfer workflow

---

## 4️⃣ Inventory

Automatic identification of unassigned assets.

### Capabilities

- Dedicated inventory view
- Asset type filtering
- Quick assignment from inventory
- Clear separation between assigned and available devices

---

## 5️⃣ Transfers

Guided multi-step asset reassignment workflow.

### Features

- Source validation (cannot select employees without assets)
- Step-based transfer wizard
- Search reset handling between steps
- Styled confirmation modal
- Complete audit trail including:
  - Standardized timestamp
  - From employee
  - To employee
  - Performed by
  - Transfer notes (popup view)
- Controlled deletion endpoint (admin-restricted)

All transfers are structured for traceability and accountability.

---

## 6️⃣ Subscriptions

Integrated SaaS and digital service tracking.

### Features

- Add and edit subscription records
- Department association
- Login URL storage
- Server-side logo fetch (CORS-safe favicon retrieval)
- Base64 file storage within MongoDB
- Clean list layout without clutter badges
- Integrated clear-data handling

Subscriptions are managed as structured organizational resources.

---

# Settings Architecture

The Settings module is fully modular and centralized.

---

## Fields

### Asset Fields
- Create and manage dynamic fields per asset type
- Field type enforcement
- Required field validation

### Employee Fields
- Extend employee schema dynamically
- Structured validation rules

---

## Personalization

- Theme configuration
- Dark mode support
- Accent consistency

---

## Branding

- Company logo upload
- Favicon configuration
- Login background customization
- Real-time preview updates

All branding assets are securely stored within MongoDB.

---

## Integration Hub

Centralized third-party integration management.

### SMTP
- TLS/SSL configuration
- Test email capability
- Export-to-email support
- Configurable sender identity

### Monday.com
- Board structure creation
- Employee-level asset matrix
- Asset types sync as columns
- Model numbers sync directly in employee rows
- Manual resync support

### Hikvision
- Device endpoint configuration
- Trailing slash normalization handling
- Structured API request management

### HRMS
- Reserved module for future HR system synchronization

### API Key
- Token-based external API access management (expandable)

---

## Database Controls

### Database
Core configuration panel.

### Database Storage
- Atlas allocated vs actual data clarity
- Storage metric visibility improvements

### Date & Time
- Standardized timestamp formatting
- Timezone handling support

### Backup & Restore
- Full system export (.assetflow format)
- ObjectId-safe serialization
- ID preservation during restore
- Assignment integrity retention

---

# Authentication Experience

AssetFlow includes a visually immersive and interactive authentication interface.

## Login Interface Highlights

### Visual Design
- Dark glassmorphism authentication panel
- Dynamic constellation background animation
- Soft particle motion with depth layering
- Subtle glow and gradient accents

### Interactive Effects
- Click-based ripple / shockwave effect
- Particle displacement interaction
- Smooth hover transitions
- Animated gradient sign-in button

### UX Enhancements
- Password visibility toggle
- Autofill styling correction for dark theme
- Responsive layout across screen sizes
- Minimal structured form layout

The login interface establishes a modern SaaS-grade experience from the first interaction.

---

# 📱 Mobile App

AssetFlow includes a native Android mobile companion app built with **React Native (Expo)**. It connects directly to the same FastAPI backend that powers the web dashboard — no separate backend required.

The mobile app is distributed as a standalone APK for internal use. It is not published to the Play Store.

---

## Mobile Tech Stack

| Technology | Purpose |
|---|---|
| React Native 0.76 | Core mobile framework |
| Expo SDK 52 | Build platform and native modules |
| React Navigation v6 | Screen navigation |
| React Native Reanimated 3 | 60fps GPU-accelerated animations |
| Zustand | Global state management |
| AsyncStorage | Local data persistence |
| Axios | HTTP client with interceptors |
| FlashList | High-performance scrollable lists |
| NetInfo | Real-time network monitoring |
| expo-haptics | Haptic feedback on interactions |

---

## How It Connects to the Backend

The mobile app is a **pure client** — it has no database or server of its own. During the onboarding setup, the user enters the backend URL (e.g. `http://192.168.1.x:8001` on a local network, or a deployed URL like `https://your-app.onrender.com`).

From that point, every API call goes directly to the FastAPI backend using the same REST endpoints as the web frontend. Authentication uses the same JWT token system — the user logs in with their AssetFlow credentials and the token is stored locally.

The app checks `GET /health` on the backend every 30 seconds to monitor connectivity. When the backend goes offline, the app automatically switches to offline mode — blocking write operations while keeping cached data readable.

```
Mobile App (React Native)
        |
        | HTTP / HTTPS
        v
FastAPI Backend (IT-ASSETS)
        |
        v
MongoDB Database
```

---

## Mobile Features

### Onboarding
A 6-scene animated setup flow on first launch. The ConnectScene features a cinematic dark forest SVG animation that runs at 60fps. When the backend connects successfully, the forest transitions from dead (dark teal) to alive (green) — signaling the app is live. Subsequent scenes let the user pick their theme and accent color.

### Dashboard
Live stat cards with animated count-up numbers. Asset type breakdown and assignment status summary. Pull-to-refresh on all data.

### Asset Management
Full create, view, edit, and delete support. Search and filter. Status badges. Role-gated write access.

### Employee Management
Full CRUD with avatar initials. Custom field support matching the web platform's dynamic employee schema.

### Subscription Tracking
View and manage SaaS subscriptions with cost display.

### Inventory
Filtered view of unassigned assets with direct navigation to asset detail.

### Transfers
Transfer history with from/to employee, performed by, and date.

### User Management
View all users with role badges. Super Admin restricted delete.

### Offline Mode
When the backend is unreachable, all write operations are blocked and a red toast notification appears. Cached list data remains readable. The ReconnectBubble panel appears to let the user re-enter or retry the backend URL.

---

## Mobile Navigation Structure

```
App Launch
  │
  ├─ First run → Onboarding (6 scenes)
  ├─ Not logged in → Login
  └─ Logged in → Main App
        ├─ Dashboard
        ├─ Assets
        │   ├─ Hub → Asset List → Asset Detail
        │   ├─ Employee List → Employee Detail
        │   ├─ Subscription List → Subscription Detail
        │   ├─ Inventory
        │   ├─ Transfers
        │   ├─ Asset Types
        │   └─ Employee Fields
        ├─ Users
        └─ Account & Settings
```

The bottom navigation bar is a floating pill-style tab bar with spring animations. All four main tabs render simultaneously with parallax slide transitions — no remounting, no flicker.

---

## Mobile Role-Based Access

| Feature | SUPER_ADMIN | ADMIN | USER |
|---|---|---|---|
| View all screens | ✅ | ✅ | ✅ |
| Add / Edit assets, employees, subscriptions | ✅ | ✅ | ❌ |
| Delete records | ✅ | ✅ | ❌ |
| Manage asset types / employee fields | ✅ | ✅ | ❌ |
| Delete users | ✅ | ❌ | ❌ |

---

## Building the Mobile APK

```bash
cd mobile
npm install
eas build -p android --profile preview
```

Requires EAS CLI (`npm install -g eas-cli`) and an Expo account linked to the project.

---

# Security & Access Control

Role-Based Access Model:

### SUPER ADMIN
- Full system access
- Settings and integrations
- User management
- Asset type control

### ADMIN
- Asset and employee management
- Transfers
- Reporting
- No system-level configuration access

### USER
- Read-only access
- View dashboards and records
- No modification permissions

Additional safeguards:

- JWT expiration auto-redirect
- Self-deletion prevention
- Backend route-order validation
- Required field enforcement
- Unique asset tag validation

---

# Data Integrity Improvements

- Duplicate asset tag prevention
- Currency conversion correction
- Transfer consistency enforcement
- Backup restore assignment safeguards
- Server-side favicon fetch implementation
- Structured deletion controls

---

# Designed For

- IT departments
- Growing startups
- Mid-sized enterprises
- Organizations managing structured IT inventory
- Teams requiring traceable asset workflows

---

AssetFlow centralizes asset visibility, improves operational control, and provides a structured foundation for scalable IT resource management — accessible from both web and mobile.
