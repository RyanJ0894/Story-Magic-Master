'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart3,
  FileText,
  Settings,
  Shield,
  Menu,
  BookOpen,
  Heart,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart3,
  FileText,
  Settings,
  BookOpen,
  Heart,
};

export interface AdminNavItem {
  name: string;
  href: string;
  icon: string;
}

interface AdminSidebarProps {
  navigation: AdminNavItem[];
  userEmail: string;
}

function SidebarContent({
  navigation,
  userEmail,
}: AdminSidebarProps) {
  return (
    <>
      <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-800">
        <Shield className="w-6 h-6 text-violet-500" />
        <span className="font-bold text-white">Story Magic</span>
        <Badge variant="secondary" className="text-xs">
          Admin
        </Badge>
      </div>

      <nav className="p-4 space-y-1">
        {navigation.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              {Icon && <Icon className="w-5 h-5" />}
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-medium">
            {userEmail?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{userEmail}</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function AdminSidebar({ navigation, userEmail }: AdminSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile header with hamburger */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-slate-900 px-4 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-64 bg-slate-900 dark:bg-slate-950 border-slate-800 p-0"
          >
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <div onClick={() => setOpen(false)}>
              <SidebarContent navigation={navigation} userEmail={userEmail} />
            </div>
          </SheetContent>
        </Sheet>
        <Shield className="w-5 h-5 text-violet-500" />
        <span className="font-semibold text-white text-sm">Admin</span>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 bg-slate-900 dark:bg-slate-950 border-r border-slate-800 md:block">
        <SidebarContent navigation={navigation} userEmail={userEmail} />
      </aside>
    </>
  );
}
