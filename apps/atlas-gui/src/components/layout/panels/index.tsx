'use client';

import { usePathname } from 'next/navigation';
import {
  Plus,
  FolderPlus,
  Upload,
  Folder,
  FileText,
  StickyNote,
  Clock,
  Bell,
  BarChart3,
  ScrollText,
  Settings,
  User,
  Mail,
  MessageCircle,
  Palette,
  Activity,
  Layout,
} from 'lucide-react';
import {
  SectionPanel,
  PanelHeader,
  PanelSearch,
  PanelScroll,
  PanelGroup,
  PanelItem,
  PanelAction,
} from '@/components/layout/section-panel';

function DashboardPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Dashboard" />
      <PanelScroll>
        <PanelGroup label="Widgets">
          <PanelItem icon={<Layout />} label="All Widgets" active />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function FilesPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Files">
        <PanelAction primary title="New folder"><FolderPlus /></PanelAction>
        <PanelAction primary title="Upload"><Upload /></PanelAction>
      </PanelHeader>
      <PanelSearch placeholder="Search files..." />
      <PanelScroll>
        <PanelGroup label="Folders">
          <PanelItem icon={<Folder />} label="All Files" active />
          <PanelItem icon={<Folder />} label="Documents" count="—" />
          <PanelItem icon={<Folder />} label="Images" count="—" />
          <PanelItem icon={<Folder />} label="Backups" count="—" />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function SchedulerPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Scheduler">
        <PanelAction primary title="New job"><Plus /></PanelAction>
      </PanelHeader>
      <PanelSearch placeholder="Search jobs..." />
      <PanelScroll>
        <PanelGroup label="Groups">
          <PanelItem icon={<Clock />} label="All Jobs" active />
          <PanelItem label="monitoring" badge={{ text: "monitoring", color: "green" }} />
          <PanelItem label="cleanup" badge={{ text: "cleanup", color: "yellow" }} />
          <PanelItem label="sync" badge={{ text: "sync", color: "blue" }} />
          <PanelItem label="alerts" badge={{ text: "alerts", color: "red" }} />
        </PanelGroup>
        <PanelGroup label="Status">
          <PanelItem label="Running" badge={{ text: "Running", color: "green" }} />
          <PanelItem label="Failed" badge={{ text: "Failed", color: "red" }} />
          <PanelItem label="Disabled" badge={{ text: "Disabled", color: "muted" }} />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function NotificationsPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Notifications" />
      <PanelScroll>
        <PanelGroup label="Filters">
          <PanelItem icon={<Bell />} label="All" active />
          <PanelItem label="Unread" badge={{ text: "Unread", color: "blue" }} />
          <PanelItem label="Read" />
        </PanelGroup>
        <PanelGroup label="Channels">
          <PanelItem icon={<Mail />} label="Email" />
          <PanelItem icon={<MessageCircle />} label="Telegram" />
        </PanelGroup>
        <PanelGroup label="Manage">
          <PanelItem icon={<Settings />} label="Preferences" />
          <PanelItem icon={<FileText />} label="Templates" />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function NotesPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Notes">
        <PanelAction primary title="New folder"><FolderPlus /></PanelAction>
        <PanelAction primary title="New note"><Plus /></PanelAction>
      </PanelHeader>
      <PanelSearch placeholder="Search notes..." />
      <PanelScroll>
        <PanelGroup label="Folders">
          <PanelItem icon={<StickyNote />} label="All Notes" active count="—" />
          <PanelItem icon={<Folder />} label="Work" count="—" />
          <PanelItem icon={<Folder />} label="Personal" count="—" />
          <PanelItem icon={<Folder />} label="Dev Notes" count="—" />
        </PanelGroup>
        <PanelGroup label="Recent">
          <PanelItem icon={<FileText />} label="Getting Started" />
          <PanelItem icon={<FileText />} label="Meeting Notes" />
          <PanelItem icon={<FileText />} label="Ideas" />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function TrackerPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Tracker">
        <PanelAction primary title="New endpoint"><Plus /></PanelAction>
      </PanelHeader>
      <PanelScroll>
        <PanelGroup label="Endpoints">
          <PanelItem icon={<BarChart3 />} label="All Endpoints" active />
          <PanelItem icon={<Activity />} label="api.example.com" badge={{ text: "", color: "green" }} />
          <PanelItem icon={<Activity />} label="cdn.example.com" badge={{ text: "", color: "green" }} />
          <PanelItem icon={<Activity />} label="db.example.com" badge={{ text: "", color: "yellow" }} />
          <PanelItem icon={<Activity />} label="staging.example.com" badge={{ text: "", color: "muted" }} />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function AuditPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Audit Log" />
      <PanelScroll>
        <PanelGroup label="Services">
          <PanelItem icon={<ScrollText />} label="All Events" active />
          <PanelItem label="atlas-core" badge={{ text: "", color: "green" }} />
          <PanelItem label="atlas-dms" badge={{ text: "", color: "green" }} />
          <PanelItem label="atlas-scheduler" badge={{ text: "", color: "green" }} />
          <PanelItem label="atlas-notify" badge={{ text: "", color: "green" }} />
          <PanelItem label="atlas-notes" badge={{ text: "", color: "green" }} />
        </PanelGroup>
        <PanelGroup label="Status">
          <PanelItem label="Success" badge={{ text: "1.2k", color: "green" }} />
          <PanelItem label="Error" badge={{ text: "14", color: "red" }} />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

function SettingsPanel() {
  return (
    <SectionPanel>
      <PanelHeader title="Settings" />
      <PanelScroll>
        <PanelGroup label="General">
          <PanelItem icon={<User />} label="Profile" active />
          <PanelItem icon={<Palette />} label="Appearance" />
        </PanelGroup>
        <PanelGroup label="System">
          <PanelItem icon={<Layout />} label="Resources" />
          <PanelItem icon={<Activity />} label="Services Health" />
        </PanelGroup>
      </PanelScroll>
    </SectionPanel>
  );
}

const panelMap: [string, () => React.JSX.Element][] = [
  ['/files', FilesPanel],
  ['/scheduler', SchedulerPanel],
  ['/notifications', NotificationsPanel],
  ['/notes', NotesPanel],
  ['/tracker', TrackerPanel],
  ['/audit', AuditPanel],
  ['/settings', SettingsPanel],
  ['/dashboard', DashboardPanel],
];

export function ActivePanel() {
  const pathname = usePathname();
  const match = panelMap.find(([prefix]) => pathname.startsWith(prefix));
  const Panel = match ? match[1] : DashboardPanel;
  return <Panel />;
}
