import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar.jsx';
import { SidebarProvider } from '../../contexts/SidebarContext.jsx';
import './Layout.css';

export default function Layout() {
  return (
    <SidebarProvider>
      <div className="layout">
        <Sidebar />
        <main className="layout__main">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
