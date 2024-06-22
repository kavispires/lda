import { Alert, Button, Form, Input, Modal, Spin } from "antd";
import { useAuthContext } from "hooks/useAuthContext";
import { ReactNode, useState } from "react";
import { SignInProps } from "services/AuthProvider";

type AuthWrapperProps = {
  children: ReactNode;
};

const layout = {
  labelCol: { span: 8 },
  wrapperCol: { span: 16 },
};
const tailLayout = {
  wrapperCol: { offset: 0, span: 8 },
};

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { signIn, isSigningIn, isLoading, isAuthenticated } = useAuthContext();
  const [openLogin, setOpenLogin] = useState(false);
  const [values, setValues] = useState<SignInProps>({ email: "", password: "" });

  const onValuesChange = (data: Partial<SignInProps>) => {
    setValues((prev) => ({ ...prev, ...data }));
  };

  if (isLoading) {
    return (
      <Spin tip="Verifying auth..." size="large">
        <div className="h-screen w-screen" />
      </Spin>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen grid place-items-center">
        <Alert
          message="You are not logged in"
          description="You can't use this app unless you are logged in."
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
            onOk={() => signIn(values)}
            confirmLoading={isSigningIn}
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
