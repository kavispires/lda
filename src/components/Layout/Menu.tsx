import { Divider, Layout, Tooltip } from 'antd';
import { DiscAlbumIcon, ListMusicIcon, MapPinIcon, PlusIcon, TrophyIcon, UsersIcon } from 'lucide-react';
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
            <DiscAlbumIcon />
          </Tooltip>
        </NavLink>

        <NavLink className="ld-menu__nav-link" to="/distributions">
          <Tooltip arrow placement="right" title="Distributions">
            <ListMusicIcon />
          </Tooltip>
        </NavLink>

        <NavLink className="ld-menu__nav-link" to="/groups">
          <Tooltip arrow placement="right" title="Groups">
            <UsersIcon />
          </Tooltip>
        </NavLink>

        <NavLink className="ld-menu__nav-link" to="/formation-templates">
          <Tooltip arrow placement="right" title="Formation Templates">
            <MapPinIcon />
          </Tooltip>
        </NavLink>

        <NavLink className="ld-menu__nav-link" to="/the-search">
          <Tooltip arrow placement="right" title="The Search">
            <TrophyIcon />
          </Tooltip>
        </NavLink>

        <Divider className="ld-menu__divider" />

        <NavLink className="ld-menu__nav-link" to="/songs/new">
          <Tooltip arrow placement="right" title="Create Song">
            <span aria-hidden="true" className="ld-menu__create-song-icon">
              <DiscAlbumIcon />
              <PlusIcon className="ld-menu__create-song-plus" />
            </span>
          </Tooltip>
        </NavLink>
      </nav>
    </Layout.Sider>
  );
}
