import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sun, Moon, User, ChevronDown, Settings, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { searchAPI } from '../../services/api';

export function Header({ sidebarCollapsed }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout, isSuperAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const debounce = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          const response = await searchAPI.search(searchQuery);
          setSearchResults(response.data);
          setShowResults(true);
        } catch (error) {
          console.error('Search failed:', error);
        }
      } else {
        setSearchResults(null);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleResultClick = (result) => {
    setShowResults(false);
    setSearchQuery('');
    if (result.type === 'asset') {
      navigate(`/assets/${result.id}`);
    } else if (result.type === 'employee') {
      navigate(`/employees/${result.id}`);
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  return (
    <header 
      className={cn(
        "fixed top-0 right-0 h-16 bg-background/80 backdrop-blur-lg border-b border-border z-30 flex items-center px-6 transition-all duration-300",
        sidebarCollapsed ? "left-[72px]" : "left-64"
      )}
      data-testid="header"
    >
      {/* Search */}
      <div className="relative flex-1 max-w-xl" ref={searchRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search assets, employees, transfers... (⌘K)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 bg-secondary/50 border-transparent focus:border-primary focus:bg-background"
          data-testid="global-search-input"
        />
        
        <AnimatePresence>
          {showResults && searchResults && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
              data-testid="search-results"
            >
              {searchResults.assets?.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted">
                    Assets
                  </div>
                  {searchResults.assets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => handleResultClick({ ...asset, type: 'asset' })}
                      className="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-3 transition-colors"
                      data-testid={`search-result-asset-${asset.id}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-mono text-primary">
                          {asset.assetType?.name?.charAt(0) || 'A'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{asset.assetTag}</div>
                        <div className="text-xs text-muted-foreground">
                          {asset.assetType?.name}
                          {asset.assignedEmployee && (
                            <span className="ml-1">
                              • Assigned to: <span className="text-foreground font-medium">{asset.assignedEmployee.name}</span>
                            </span>
                          )}
                          {!asset.assignedEmployee && ' • In Inventory'}
                        </div>
                        {asset.assignmentHistoryCount > 1 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {asset.assignmentHistoryCount} previous assignments
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {searchResults.employees?.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted">
                    Employees
                  </div>
                  {searchResults.employees.map((employee) => (
                    <button
                      key={employee.id}
                      onClick={() => handleResultClick({ ...employee, type: 'employee' })}
                      className="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-3 transition-colors"
                      data-testid={`search-result-employee-${employee.id}`}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {getInitials(employee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {employee.employeeId}
                          {employee.assetCount !== undefined && (
                            <span className="ml-1">
                              • {employee.assetCount} {employee.assetCount === 1 ? 'asset' : 'assets'}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {(!searchResults.assets?.length && !searchResults.employees?.length) && (
                <div className="px-4 py-6 text-center text-muted-foreground">
                  No results found
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Side - pushed to far right with ml-auto and right padding */}
      <div className="flex items-center gap-4 ml-auto pr-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="relative"
          data-testid="theme-toggle"
        >
          <AnimatePresence mode="wait">
            {theme === 'light' ? (
              <motion.div
                key="sun"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Sun className="w-5 h-5" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Moon className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-3 py-1.5 rounded-full transition-all"
              style={{ border: '1px solid rgb(var(--primary))', boxShadow: '0 0 8px rgba(var(--primary), 0.3)' }}
              data-testid="user-menu-trigger">
              <span className="font-medium hidden md:inline" style={{ color: 'rgb(var(--primary))' }}>{user?.name}</span>
              <ChevronDown className="w-4 h-4" style={{ color: 'rgb(var(--primary))' }} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                <span className="text-xs font-normal text-primary mt-1">{user?.role}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')} data-testid="profile-menu-item">
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            {isSuperAdmin && (
              <DropdownMenuItem onClick={() => navigate('/settings')} data-testid="settings-menu-item">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive" data-testid="logout-menu-item">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
