import { Avatar } from 'antd';

export function LyricBox() {
  return (
    <div className="lyric-box">
      <div className="lyric-box__avatars">
        <Avatar src="https://randomuser.me/api/portraits/men/94.jpg" alt="avatar" />
        <Avatar src="https://randomuser.me/api/portraits/women/93.jpg" alt="avatar" />
      </div>
      <div className="lyric-box__content">
        <div className="lyric-box__speakers">
          <span>John Doe</span>
          <span>Jane Doe</span>
        </div>
        <div className="lyric-box__text">
          <p>Some lyrics here</p>
          <p>Some more lyrics here</p>
          <p>Even more lyrics here</p>
        </div>
      </div>
    </div>
  );
}

export function AdlibBox() {
  return <div className="lyric-box">?</div>;
}
