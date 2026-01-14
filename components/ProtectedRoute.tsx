import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../services/auth';

interface Props {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
  const isAuth = authService.isAuthenticated();
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
};