import { Content } from 'components/Content';

export function HomePage() {
  return (
    <Content style={{ margin: 0 }}>
      <div className="relative w-full h-full min-h-screen">
        {/* Background image with full coverage */}
        <img
          src="images/background.jpg"
          alt="LD background"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />

        {/* Logo centered on top of background */}
        <div className="absolute z-10 w-full h-full flex items-center justify-center">
          <img src="images/logo.svg" alt="LD logo" className="w-[30vw] min-w-[150px] max-w-[300px]" />
        </div>
      </div>
    </Content>
  );
}
