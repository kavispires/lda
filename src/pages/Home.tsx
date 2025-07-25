import { Content } from 'components/Content';

export function HomePage() {
  return (
    <Content>
      <div className="w-full  grid place-items-center">
        <img src={'images/logo.svg'} alt="LD logo" style={{ maxWidth: '30vw', minWidth: '300px' }} />
      </div>
    </Content>
  );
}
