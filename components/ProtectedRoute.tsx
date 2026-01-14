import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { authService } from '../services/auth';

export const ProtectedRoute = () => {
  const isAuth = authService.isAuthenticated();
  return isAuth ? <Outlet /> : <Navigate to="/login" replace />;
};