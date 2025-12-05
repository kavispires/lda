import { Content } from 'components/Content';

export function HomePage() {
  return (
    <Content
      className="w-full grid place-items-center"
      style={{
        height: '100%',
        backgroundImage: 'url(images/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        margin: '0',
      }}
    >
      <div className="w-full grid place-items-center">
        <img
          alt="LD logo"
          src={'images/logo.svg'}
          style={{ maxWidth: '30vw', minWidth: '300px', opacity: 0.8 }}
        />
      </div>
    </Content>
  );
}
