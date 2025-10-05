import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '@/hooks/use-auth';

export default function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}
