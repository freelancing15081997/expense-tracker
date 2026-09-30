import React from 'react';
import { css } from '../ui/css.js';
import Sidebar from './Sidebar.jsx';
import CaBanner from './CaBanner.jsx';
import ViewAsBanner from './ViewAsBanner.jsx';
import Topbar from './Topbar.jsx';
import PageLoader from './PageLoader.jsx';
import Page from '../pages/Page.jsx';
import SidePanel from '../overlays/SidePanel.jsx';
import DocEditor from '../overlays/DocEditor.jsx';
import FormDrawer from '../overlays/FormDrawer.jsx';
import Modal from '../overlays/Modal.jsx';
import CommandPalette from '../overlays/CommandPalette.jsx';
import WorkspaceMenu from '../overlays/WorkspaceMenu.jsx';
import Toast from '../overlays/Toast.jsx';
import SidebarFlyout from '../overlays/SidebarFlyout.jsx';
import Dropdown from '../overlays/Dropdown.jsx';
import BootLoader from '../overlays/BootLoader.jsx';
import ProfileMenu from '../overlays/ProfileMenu.jsx';

export default function AppShell({ v }) {
  return (
    <div style={css("position:relative;height:100vh;display:flex;overflow:hidden;background:radial-gradient(1200px 500px at 70% -10%,rgba(45,212,191,.08),transparent 60%),#F5F6F8")} data-bz-root="1">
      <Sidebar v={v} />
      {' '}
      <main style={css("position:relative;flex:1;min-width:0;height:100%;display:flex;flex-direction:column")}>
        {v.caOn ? <CaBanner v={v} /> : null}
        {' '}
        {v.va ? <ViewAsBanner v={v} /> : null}
        {' '}
        <Topbar v={v} />
        {' '}
        {v.busy ? <PageLoader v={v} /> : null}
        {' '}
        <Page v={v} />
        {' '}
        {v.fly?.open ? <SidePanel v={v} /> : null}
        {' '}
        {v.ed?.open ? <DocEditor v={v} /> : null}
      </main>
      {' '}
      {v.modal?.isDrawer ? <FormDrawer v={v} /> : null}
      {' '}
      {v.modal?.center ? <Modal v={v} /> : null}
      {' '}
      {v.cmd ? <CommandPalette v={v} /> : null}
      {' '}
      {v.ws ? <WorkspaceMenu v={v} /> : null}
      {v.pm ? <ProfileMenu v={v} /> : null}
      {' '}
      {v.hasToast ? <Toast v={v} /> : null}
      {' '}
      {v.hov?.open ? <SidebarFlyout v={v} /> : null}
      {' '}
      {v.pop?.open ? <Dropdown v={v} /> : null}
      {' '}
      {v.boot?.show ? <BootLoader v={v} /> : null}
    </div>
  );
}
