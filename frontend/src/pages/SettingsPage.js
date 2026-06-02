import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Package,
  Users,
  UserCog,
  Palette,
  Building2,
  Plug,
  Mail,
  Calendar,
  ChevronRight,
  ArrowLeft,
  LayoutDashboard,
  Key,
  ShieldCheck,
  Database as DatabaseIcon,
  Server,
  Trash2,
  Clock,
  ArchiveRestore,
  Music,
  CarFront
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/button';
import { AssetTypesSettings } from '../components/settings/AssetTypesSettings';
import { EmployeeFieldsSettings } from '../components/settings/EmployeeFieldsSettings';
import { DashboardSettings } from '../components/settings/DashboardSettings';
import { UserManagementSettings } from '../components/settings/UserManagementSettings';
import { BrandingSettings } from '../components/settings/BrandingSettings';
import { SMTPSettings } from '../components/settings/SMTPSettings';
import { MondayIntegrationSettings } from '../components/settings/MondayIntegrationSettings';
import { HikvisionSettings } from '../components/settings/HikvisionSettings';
import { PersonalizationSettings } from '../components/settings/PersonalizationSettings';
import { DatabaseStatusSettings } from '../components/settings/DatabaseStatusSettings';
import { ClearDataSettings } from '../components/settings/ClearDataSettings';
import { DateTimeSettings } from '../components/settings/DateTimeSettings';
import { BackupRestoreSettings } from '../components/settings/BackupRestoreSettings';
import { AppMusicSettings } from '../components/settings/AppMusicSettings';
import { VehicleFieldsSettings } from '../components/settings/VehicleFieldsSettings';
import { cn } from '../lib/utils';

// Settings tree structure
const settingsTree = [
  {
    id: 'fields',
    label: 'Fields',
    icon: Package,
    children: [
      { id: 'asset-fields', label: 'Asset Fields', icon: Package },
      { id: 'employee-fields', label: 'Employee Fields', icon: Users },
      { id: 'vehicle-fields', label: 'Vehicle Fields', icon: CarFront },
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    id: 'personalization',
    label: 'Personalization',
    icon: Palette,
    children: null
  },
  {
    id: 'app-music',
    label: 'App Music',
    icon: Music,
    children: null
  },
  {
    id: 'branding',
    label: 'Branding',
    icon: Building2,
    children: null
  },
  {
    id: 'integration',
    label: 'Integration',
    icon: Plug,
    children: [
      { id: 'smtp', label: 'SMTP', icon: Mail },
      { id: 'monday', label: 'Monday.com', icon: Calendar },
      { id: 'hikvision', label: 'Hikvision', icon: ShieldCheck },
      { id: 'hrms', label: 'HRMS', icon: DatabaseIcon, disabled: true, comingSoon: true },
      { id: 'api-key', label: 'API Key', icon: Key, disabled: true, comingSoon: true },
    ]
  },
  {
    id: 'database',
    label: 'Database',
    icon: Server,
    children: null
  },
  {
    id: 'users',
    label: 'User Settings',
    icon: UserCog,
    children: null
  },
  {
    id: 'clear-data',
    label: 'Database Storage',
    icon: Trash2,
    children: null
  },
  {
    id: 'datetime',
    label: 'Date & Time',
    icon: Clock,
    children: null
  },
  {
    id: 'backup-restore',
    label: 'Backup & Restore',
    icon: ArchiveRestore,
    children: null
  },
];

function SettingsSidebar({ activeItem, onSelectItem, expandedGroups, onToggleGroup }) {
  const navigate = useNavigate();

  return (
    <div className="w-64 min-w-64 border-r border-border bg-card/50 h-full flex flex-col">
      {/* Back Button */}
      <div className="p-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          data-testid="back-to-dashboard-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </div>

      {/* Settings Tree */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {settingsTree.map((item) => {
          const Icon = item.icon;
          const isExpanded = expandedGroups.includes(item.id);
          const hasChildren = item.children && item.children.length > 0;
          const isActive = activeItem === item.id || 
            (item.children && item.children.some(child => child.id === activeItem));

          return (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (hasChildren) {
                    onToggleGroup(item.id);
                  } else {
                    onSelectItem(item.id);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  "hover:bg-accent",
                  isActive && !hasChildren && "bg-primary/10 text-primary",
                  isActive && hasChildren && "text-foreground"
                )}
                data-testid={`settings-nav-${item.id}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {hasChildren && (
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </motion.div>
                )}
              </button>

              {/* Children */}
              <AnimatePresence>
                {hasChildren && isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-6 mt-1 space-y-1 border-l-2 border-border pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <button
                            key={child.id}
                            onClick={() => !child.disabled && onSelectItem(child.id)}
                            disabled={child.disabled}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                              "hover:bg-accent",
                              activeItem === child.id && "bg-primary/10 text-primary font-medium",
                              child.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                            )}
                            data-testid={`settings-nav-${child.id}`}
                          >
                            <ChildIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1 text-left">{child.label}</span>
                            {child.comingSoon && (
                              <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                                Soon
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export default function SettingsPage() {
  const [activeItem, setActiveItem] = useState('asset-fields');
  const [expandedGroups, setExpandedGroups] = useState([]);

  const handleToggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const renderContent = () => {
    switch (activeItem) {
      case 'asset-fields':
        return <AssetTypesSettings />;
      case 'employee-fields':
        return <EmployeeFieldsSettings />;
      case 'vehicle-fields':
        return <VehicleFieldsSettings />;
      case 'dashboard':
        return <DashboardSettings />;
      case 'personalization':
        return <PersonalizationSettings />;
      case 'app-music':
        return <AppMusicSettings />;
      case 'branding':
        return <BrandingSettings />;
      case 'smtp':
        return <SMTPSettings />;
      case 'monday':
        return <MondayIntegrationSettings />;
      case 'hikvision':
        return <HikvisionSettings />;
      case 'database':
        return <DatabaseStatusSettings />;
      case 'users':
        return <UserManagementSettings />;
      case 'clear-data':
        return <ClearDataSettings />;
      case 'datetime':
        return <DateTimeSettings />;
      case 'backup-restore':
        return <BackupRestoreSettings />;
      default:
        return <AssetTypesSettings />;
    }
  };

  const getTitle = () => {
    const findItem = (items) => {
      for (const item of items) {
        if (item.id === activeItem) return item.label;
        if (item.children) {
          const found = item.children.find(child => child.id === activeItem);
          if (found) return found.label;
        }
      }
      return 'Settings';
    };
    return findItem(settingsTree);
  };

  return (
    <div data-testid="settings-page" className="flex -m-4 sm:-m-6 lg:-m-8" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Settings Sidebar */}
      <SettingsSidebar
        activeItem={activeItem}
        onSelectItem={setActiveItem}
        expandedGroups={expandedGroups}
        onToggleGroup={handleToggleGroup}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
          <PageHeader 
            title={getTitle()}
            description="Configure your IT Asset Management system"
          />
          
          <motion.div
            key={activeItem}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-6"
          >
            {renderContent()}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
