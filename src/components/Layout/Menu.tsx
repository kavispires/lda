import { Divider, Layout, Tooltip } from 'antd';
import { NavLink } from 'react-router-dom';
import './Menu.scss';

export function Menu() {
  return (
    <Layout.Sider className="ld-menu" collapsedWidth={64} defaultCollapsed>
      <nav className="ld-menu__nav">
        <NavLink className="ld-menu__nav-link" to="/">
          <img alt="LD logo" className="ld-menu__logo" src={'images/logo.svg'} />
        </NavLink>

        <NavLink className="ld-menu__nav-link" to="/songs">
          <Tooltip arrow placement="right" title="Songs">
            <i className="fi fi-rr-calendar" />
          </Tooltip>
        </NavLink>

        <NavLink className="ld-menu__nav-link" to="/distributions">
          <Tooltip arrow placement="right" title="Distributions">
            <i className="fi fi-rs-list-music" />
          </Tooltip>
        </NavLink>

        <NavLink className="ld-menu__nav-link" to="/groups">
          <Tooltip arrow placement="right" title="Groups">
            <i className="fi fi-rr-users-alt" />
          </Tooltip>
        </NavLink>

        <Divider className="ld-menu__divider" />

        <NavLink className="ld-menu__nav-link" to="/songs/new">
          <Tooltip arrow placement="right" title="Create Song">
            <i className="fi fi-rs-album-circle-plus" />
          </Tooltip>
        </NavLink>
      </nav>
    </Layout.Sider>
  );
}
