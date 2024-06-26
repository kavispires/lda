import { Divider, Layout } from "antd";
import clsx from "clsx";
import { useState } from "react";
import { NavLink } from "react-router-dom";

const classes = {
  menu: "h-screen bg-gradient-to-t from-[#0f1014] via-[#131725] via-[#161d36] via-[#1a2348] via-[#1f295a] to-[#203b73] text-white",
  menuNav: "grid w-full transition-all duration-500 sticky top-[9px]",
  menuNavCollapsed: "",
  menuHome: "flex w-full py-[3px] pr-[6px] pb-[18px] pl-[6px]",
  menuNavLink:
    "flex my-[3px] mx-0 py-[9px] px-[9px] items-center rounded-[var(--border-radius)] hover:bg-[var(--color-primary)] hover:text-white",
  menuNavText: "ml-[6px]",
};

export function Menu() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <Layout.Sider
      // className="h-screen"
      className={classes.menu}
      collapsedWidth={64}
      collapsed={collapsed}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
      defaultCollapsed
    >
      <nav className={clsx(classes.menuNav, collapsed && classes.menuNavCollapsed)}>
        <NavLink to="/" className={classes.menuHome}>
          {/* <LogoIcon className="menu__logo" /> {!collapsed && <LogoText className="menu__logo-text" />} */}
          LD
        </NavLink>

        <NavLink to="/songs" className={classes.menuNavLink}>
          <i className="fi fi-rr-calendar" />{" "}
          {!collapsed && <span className={classes.menuNavText}>Songs</span>}
        </NavLink>

        <NavLink to="/distributions" className={classes.menuNavLink}>
          <i className="fi fi-rs-list-music" />{" "}
          {!collapsed && <span className={classes.menuNavText}>Distributions</span>}
        </NavLink>

        <NavLink to="/groups" className={classes.menuNavLink}>
          <i className="fi fi-rr-users-alt" />{" "}
          {!collapsed && <span className={classes.menuNavText}>Groups</span>}
        </NavLink>

        <Divider />

        <NavLink to="/songs/new" className={classes.menuNavLink}>
          <i className="fi fi-rs-album-circle-plus" />{" "}
          {!collapsed && <span className={classes.menuNavText}>New Song</span>}
        </NavLink>

        <NavLink to="/distributions/new" className={classes.menuNavLink}>
          <i className="fi fi-rr-books-medical" />{" "}
          {!collapsed && <span className={classes.menuNavText}>New Distribute</span>}
        </NavLink>

        <NavLink to="/groups/new" className={classes.menuNavLink}>
          <i className="fi fi-rr-users-medical" />{" "}
          {!collapsed && <span className={classes.menuNavText}>New Group</span>}
        </NavLink>
      </nav>
    </Layout.Sider>
  );
}
