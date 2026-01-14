import React from 'react';
import { Redirect } from 'react-router-dom';
import { authService } from '../services/auth';

interface Props {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: Props) => {
  const isAuth = authService.isAuthenticated();
  return isAuth ? <>{children}</> : <Redirect to="/login" />;
};