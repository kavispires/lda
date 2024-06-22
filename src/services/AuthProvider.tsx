import { message } from "antd";
import { FirebaseError } from "firebase/app";
import { User } from "firebase/auth";
import { createContext, ReactNode, useState } from "react";
import { useEffectOnce } from "react-use";

import { UseMutateFunction, useMutation } from "@tanstack/react-query";

import { auth, signIn } from "./firebase";

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

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffectOnce(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setAuthenticatedUser(user);

        message.info("You are logged in");
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
      console.log({ response });
      return response.user;
    },
    onSuccess: (data) => {
      message.success("You were logged in");
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
