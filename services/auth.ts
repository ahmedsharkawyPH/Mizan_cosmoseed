
import { User } from '../types';

export const PERMISSIONS = [
  { id: 'VIEW_DASHBOARD', label: 'View Dashboard' },
  { id: 'VIEW_REPORTS', label: 'View Reports' },
  { id: 'MANAGE_SALES', label: 'Manage Sales (Invoices)' },
  { id: 'MANAGE_INVENTORY', label: 'Manage Inventory' },
  { id: 'MANAGE_STOCK_TAKE', label: 'Perform Stock Take' },
  { id: 'MANAGE_CUSTOMERS', label: 'Manage Customers' },
  { id: 'MANAGE_SUPPLIERS', label: 'Manage Suppliers' },
  { id: 'MANAGE_REPS', label: 'Manage Representatives' },
  { id: 'MANAGE_WAREHOUSES', label: 'Manage Warehouses' },
  { id: 'MANAGE_CASH', label: 'Cash Register Access' },
  { id: 'MANAGE_SETTINGS', label: 'System Settings' },
  { id: 'MANAGE_USERS', label: 'Manage Users' },
];

// Permissions specific to Sales Reps (Strict)
const REP_PERMISSIONS = [
    'MANAGE_SALES',      // Create Invoices & Returns
    'MANAGE_CASH',       // Create Receipts
    'MANAGE_CUSTOMERS',  // View Customers & Statements
];

// Permissions for Telesales
const TELESALES_PERMISSIONS = [
    'MANAGE_SALES',
    'MANAGE_CUSTOMERS',
    'VIEW_DASHBOARD',
    'MANAGE_INVENTORY', // View stock
    'MANAGE_CASH',
];

const ALL_PERMISSIONS_IDS = PERMISSIONS.map(p => p.id);

const DEFAULT_USERS = [
  // 1 General Manager
  { 
      id: '1', 
      username: 'admin', // CHANGED: admin instead of manager
      password: '123', 
      name: 'General Manager', 
      role: 'ADMIN', 
      avatar: 'GM',
      permissions: ALL_PERMISSIONS_IDS
  },
  // 3 Telesales
  { id: 't1', username: 'tele1', password: '123', name: 'Telesales 1', role: 'TELESALES', avatar: 'T1', permissions: TELESALES_PERMISSIONS },
  { id: 't2', username: 'tele2', password: '123', name: 'Telesales 2', role: 'TELESALES', avatar: 'T2', permissions: TELESALES_PERMISSIONS },
  { id: 't3', username: 'tele3', password: '123', name: 'Telesales 3', role: 'TELESALES', avatar: 'T3', permissions: TELESALES_PERMISSIONS },
  // 5 Sales Reps
  { id: 'r1', username: 'rep1', password: '123', name: 'Rep 1', role: 'REP', avatar: 'R1', permissions: REP_PERMISSIONS },
  { id: 'r2', username: 'rep2', password: '123', name: 'Rep 2', role: 'REP', avatar: 'R2', permissions: REP_PERMISSIONS },
  { id: 'r3', username: 'rep3', password: '123', name: 'Rep 3', role: 'REP', avatar: 'R3', permissions: REP_PERMISSIONS },
  { id: 'r4', username: 'rep4', password: '123', name: 'Rep 4', role: 'REP', avatar: 'R4', permissions: REP_PERMISSIONS },
  { id: 'r5', username: 'rep5', password: '123', name: 'Rep 5', role: 'REP', avatar: 'R5', permissions: REP_PERMISSIONS },
];

const loadUsers = (): any[] => {
  const stored = localStorage.getItem('app_users');
  if (!stored) {
      localStorage.setItem('app_users', JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
  }
  
  const users = JSON.parse(stored);
  
  // FIX: Check if we have 'manager' from previous session and rename to 'admin'
  const managerIndex = users.findIndex((u: any) => u.username === 'manager');
  const adminIndex = users.findIndex((u: any) => u.username === 'admin');
  
  if (managerIndex !== -1 && adminIndex === -1) {
      users[managerIndex].username = 'admin';
      localStorage.setItem('app_users', JSON.stringify(users));
  }
  
  return users;
};

export const authService = {
  login: (username: string, password: string): Promise<User> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = loadUsers();
        // Simple case-insensitive check for username
        const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        if (user) {
          const { password, ...userWithoutPass } = user;
          localStorage.setItem('user', JSON.stringify(userWithoutPass));
          resolve(userWithoutPass);
        } else {
          reject(new Error('Invalid credentials'));
        }
      }, 500);
    });
  },
  
  logout: () => {
    localStorage.removeItem('user');
    window.location.href = '/#/login';
  },

  getCurrentUser: (): User | null => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('user');
  },

  hasPermission: (permId: string): boolean => {
      const user = authService.getCurrentUser();
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      return user.permissions?.includes(permId) || false;
  },

  getUsers: () => loadUsers(),
  
  saveUser: (user: any) => {
      const users = loadUsers();
      if (user.id) {
          const idx = users.findIndex((u: any) => u.id === user.id);
          if (idx !== -1) {
              // Update existing
              users[idx] = { ...users[idx], ...user };
              // Don't overwrite password if empty
              if (!user.password) users[idx].password = loadUsers()[idx].password; 
          }
      } else {
          // Add new
          users.push({ ...user, id: Date.now().toString() });
      }
      localStorage.setItem('app_users', JSON.stringify(users));
  },

  deleteUser: (id: string) => {
      const users = loadUsers().filter((u: any) => u.id !== id);
      localStorage.setItem('app_users', JSON.stringify(users));
  },

  verifyAdminPassword: (password: string): boolean => {
      const users = loadUsers();
      // Check if ANY admin has this password
      return users.some((u: any) => u.role === 'ADMIN' && u.password === password);
  }
};
