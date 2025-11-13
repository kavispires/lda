import { Content } from 'components/Content';

export function HomePage() {
  return (
    <Content>
      <div className="w-full  grid place-items-center">
        <img alt="LD logo" src={'images/logo.svg'} style={{ maxWidth: '30vw', minWidth: '300px' }} />
      </div>
    </Content>
  );
}
