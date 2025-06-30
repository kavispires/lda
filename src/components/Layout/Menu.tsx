import { Divider, Layout, Tooltip } from 'antd';
import { NavLink } from 'react-router-dom';
import './Menu.scss';

export function Menu() {
  return (
    <Layout.Sider className="ld-menu" collapsedWidth={64} defaultCollapsed>
      <nav className="ld-menu__nav">
        <NavLink to="/" className="ld-menu__nav-link">
          <img src={'images/logo.svg'} alt="LD logo" className="ld-menu__logo" />
        </NavLink>

        <NavLink to="/songs" className="ld-menu__nav-link">
          <Tooltip title="Songs" arrow placement="right">
            <i className="fi fi-rr-calendar" />
          </Tooltip>
        </NavLink>

        <NavLink to="/distributions" className="ld-menu__nav-link">
          <Tooltip title="Distributions" arrow placement="right">
            <i className="fi fi-rs-list-music" />
          </Tooltip>
        </NavLink>

        <NavLink to="/groups" className="ld-menu__nav-link">
          <Tooltip title="Groups" arrow placement="right">
            <i className="fi fi-rr-users-alt" />
          </Tooltip>
        </NavLink>

        <Divider className="ld-menu__divider" />

        <NavLink to="/songs/new" className="ld-menu__nav-link">
          <Tooltip title="Create Song" arrow placement="right">
            <i className="fi fi-rs-album-circle-plus" />
          </Tooltip>
        </NavLink>
      </nav>
    </Layout.Sider>
  );
}
