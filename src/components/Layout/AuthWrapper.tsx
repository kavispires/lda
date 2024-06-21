import type { User } from "firebase/auth";

import { Alert, App, Button, Form, Input, Modal, Spin } from "antd";
import { ReactNode, useState } from "react";
import { useEffectOnce } from "react-use";
import { auth, signIn } from "services/firebase";
import { useMutation } from "@tanstack/react-query";

type AuthWrapperProps = {
  children: ReactNode;
};

type FormValues = {
  email: string;
  password: string;
};

const layout = {
  labelCol: { span: 8 },
  wrapperCol: { span: 16 },
};
const tailLayout = {
  wrapperCol: { offset: 0, span: 8 },
};

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { message } = App.useApp();
  const [openLogin, setOpenLogin] = useState(false);
  const [values, setValues] = useState<FormValues>({ email: "", password: "" });

  useEffectOnce(() => {
    auth.onAuthStateChanged((user) => {
      if (user) {
        setAuthenticatedUser(user);
        message.info("You are logged in!");
      } else {
        setAuthenticatedUser(null);
      }

      setIsLoading(false);
    });
  });

  const onValuesChange = (data: Partial<FormValues>) => {
    console.log(data);
    setValues((prev) => ({ ...prev, ...data }));
  };

  const mutation = useMutation({
    mutationFn: () => signIn(values.email, values.password),
    onSuccess: (data) => {
      setAuthenticatedUser(data.user);
      message.success("You are logged in!");
      setOpenLogin(false);
    },
  });

  if (isLoading) {
    return (
      <Spin tip="Verifying auth..." size="large">
        <div className="h-screen w-screen" />
      </Spin>
    );
  }

  if (!authenticatedUser) {
    return (
      <div className="h-screen w-screen grid place-items-center">
        <Alert
          message="You are not logged in"
          description="This app does not feature login capabilities."
          type="info"
          showIcon
          action={
            <Button type="primary" ghost onClick={() => setOpenLogin(true)}>
              Login
            </Button>
          }
        />
        <Form {...layout} layout="vertical" name="sign-in" autoComplete="off" onValuesChange={onValuesChange}>
          <Modal
            title="Login"
            open={openLogin}
            onOk={() => mutation.mutate()}
            confirmLoading={mutation.isPending}
            onCancel={() => setOpenLogin(false)}
            okText="Login"
            okButtonProps={{
              htmlType: "submit",
            }}
          >
            <Form.Item {...tailLayout} label="E-mail" name="email" className="login__form-item">
              <Input type="email" />
            </Form.Item>
            <Form.Item {...tailLayout} label="Password" name="password" className="login__form-item">
              <Input type="password" />
            </Form.Item>
          </Modal>
        </Form>
      </div>
    );
  }

  return <>{children}</>;
}
