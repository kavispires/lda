import { Alert, Button, Form, Input, Modal, Spin } from 'antd';
import { type PropsWithChildren, useState } from 'react';
import { type SignInProps, useAuthContext } from 'services/AuthProvider';

const layout = {
  labelCol: { span: 8 },
  wrapperCol: { span: 16 },
};
const tailLayout = {
  wrapperCol: { offset: 0, span: 8 },
};

export function AuthWrapper({ children }: PropsWithChildren) {
  const { signIn, isSigningIn, isLoading, isAuthenticated } = useAuthContext();
  const [openLogin, setOpenLogin] = useState(false);
  const [values, setValues] = useState<SignInProps>({ email: '', password: '' });

  const onValuesChange = (data: Partial<SignInProps>) => {
    setValues((prev) => ({ ...prev, ...data }));
  };

  if (isLoading) {
    return (
      <Spin size="large" tip="Verifying auth...">
        <div className="h-screen w-screen" />
      </Spin>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen grid place-items-center">
        <Alert
          action={
            <Button ghost onClick={() => setOpenLogin(true)} type="primary">
              Login
            </Button>
          }
          description="You can't use this app unless you are logged in."
          message="You are not logged in"
          showIcon
          type="info"
        />
        <Form {...layout} autoComplete="off" layout="vertical" name="sign-in" onValuesChange={onValuesChange}>
          <Modal
            confirmLoading={isSigningIn}
            okButtonProps={{
              htmlType: 'submit',
            }}
            okText="Login"
            onCancel={() => setOpenLogin(false)}
            onOk={() => signIn(values)}
            open={openLogin}
            title="Login"
          >
            <Form.Item {...tailLayout} className="login__form-item" label="E-mail" name="email">
              <Input type="email" />
            </Form.Item>
            <Form.Item {...tailLayout} className="login__form-item" label="Password" name="password">
              <Input type="password" />
            </Form.Item>
          </Modal>
        </Form>
      </div>
    );
  }

  return <>{children}</>;
}
