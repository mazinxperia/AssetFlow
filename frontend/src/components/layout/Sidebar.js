import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Boxes, 
  CarFront,
  ArrowLeftRight,
  Wallet, 
  // CreditCard used for subscriptions - see below
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Base navigation items for all users
const baseNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/assets', label: 'Assets', icon: Package },
  { path: '/employees', label: 'Employees', icon: Users },
  { path: '/inventory', label: 'Inventory', icon: Boxes },
];

// Items only for ADMIN and SUPER_ADMIN
const adminNavItems = [
  { path: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
];

// Subscriptions - visible to ADMIN and SUPER_ADMIN
const subscriptionNavItems = [
  { path: '/subscriptions', label: 'Subscriptions', icon: Wallet },
];

// Vehicle Fleet is visible to everyone, but kept as its own section
const vehicleNavItems = [
  { path: '/vehicles', label: 'Vehicle Fleet', icon: CarFront },
];

// Settings only for SUPER_ADMIN
const superAdminItems = [
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ onCollapse }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { logout, isSuperAdmin, user } = useAuth();
  const { branding } = useBranding();

  const handleToggle = () => {
    setCollapsed(!collapsed);
    if (onCollapse) {
      onCollapse(!collapsed);
    }
  };

  const sidebarVariants = {
    expanded: { width: 256 },
    collapsed: { width: 72 }
  };


  return (
    <TooltipProvider delayDuration={1000}>
      <motion.aside
        initial={false}
        animate={collapsed ? 'collapsed' : 'expanded'}
        variants={sidebarVariants}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 h-screen glass-sidebar border-r border-border z-40 flex flex-col max-md:hidden"
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <motion.div
              animate={{ width: collapsed ? 32 : 40, height: collapsed ? 32 : 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex items-center justify-center flex-shrink-0"
            >
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full rounded-xl bg-primary flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-heading font-semibold text-lg whitespace-nowrap overflow-hidden text-foreground"
                >
                  {branding.appName}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {/* Base items for all users */}
          {baseNavItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              collapsed={collapsed}
              isActive={location.pathname.startsWith(item.path)}
            />
          ))}
          
          {/* Admin items - hidden for USER role */}
          {user?.role !== 'USER' && adminNavItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              collapsed={collapsed}
              isActive={location.pathname.startsWith(item.path)}
            />
          ))}

          {user?.role !== 'USER' && (
            <>
              <div className="my-2 mx-1 border-t border-border/60" />
              {subscriptionNavItems.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  collapsed={collapsed}
                  isActive={location.pathname.startsWith(item.path)}
                />
              ))}
            </>
          )}

          <div className="my-2 mx-1 border-t border-border/60" />
          {vehicleNavItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              collapsed={collapsed}
              isActive={location.pathname.startsWith(item.path)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div>
          {isSuperAdmin && (
            <div className="p-3">
              {superAdminItems.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  collapsed={collapsed}
                  isActive={location.pathname.startsWith(item.path)}
                />
              ))}
            </div>
          )}
          <div className="p-3 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-muted-foreground hover:text-destructive",
                  collapsed && "justify-center px-0"
                )}
                onClick={logout}
                data-testid="logout-button"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="ml-3 whitespace-nowrap"
                    >
                      Logout
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Logout</TooltipContent>}
          </Tooltip>
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={handleToggle}
          className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-accent transition-colors"
          data-testid="sidebar-toggle"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </motion.aside>
    </TooltipProvider>
  );
}

function NavItem({ item, collapsed, isActive }) {
  const Icon = item.icon;
  
  const link = (
    <NavLink
      to={item.path}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
        "hover:bg-primary/15",
        isActive && "bg-primary/20 font-semibold",
        collapsed && "justify-center px-0"
      )}
      data-testid={`nav-${item.label.toLowerCase()}`}
    >
      <Icon
        className="w-5 h-5 flex-shrink-0"
        style={{ color: isActive ? 'var(--primary)' : 'currentColor', opacity: isActive ? 1 : 0.45 }}
      />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            style={{ opacity: isActive ? 1 : 0.55, fontWeight: isActive ? 600 : 500 }}
            className="whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {isActive && !collapsed && (
        <motion.div
          layoutId="activeIndicator"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
        />
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
