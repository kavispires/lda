import { message } from 'antd';
import type { FirebaseError } from 'firebase/app';
import type { User } from 'firebase/auth';
import { createContext, type PropsWithChildren, useContext, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { type UseMutateFunction, useMutation } from '@tanstack/react-query';

import { auth, signIn } from './firebase';

export type SignInProps = {
  email: string;
  password: string;
};

export const AuthContext = createContext<{
  user: User | null;
  isLoading: boolean;
  isSigningIn: boolean;
  isAuthenticated: boolean;
  signIn: UseMutateFunction<User, FirebaseError, SignInProps, unknown>;
}>({
  user: null,
  isLoading: true,
  isSigningIn: false,
  isAuthenticated: false,
  signIn: () => {},
});

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffectOnce(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setAuthenticatedUser(user);

        message.info('You are logged in');
      } else {
        setAuthenticatedUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  });

  const { isPending: isSigningIn, mutate } = useMutation<User, FirebaseError, SignInProps>({
    mutationFn: async ({ email, password }) => {
      const response = await signIn(email, password);
      return response.user;
    },
    onSuccess: (data) => {
      message.success('You were logged in');
      setAuthenticatedUser(data);
    },
    onError: (error) => {
      message.error(error.message);
    },
  });

  const isAuthenticated = Boolean(authenticatedUser);

  return (
    <AuthContext.Provider
      value={{
        user: authenticatedUser,
        isLoading: isLoading,
        isSigningIn,
        isAuthenticated,
        signIn: mutate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
};
