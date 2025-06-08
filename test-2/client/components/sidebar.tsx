"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
    LayoutDashboard,
    Network,
    Brain,
    BarChart3,
    Settings,
    Wifi,
    Server
} from "lucide-react";

interface SidebarProps {
    nodeId?: string;
    isNetworkActive?: boolean;
}

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Network', href: '/network', icon: Network },
    { name: 'Training', href: '/training', icon: Brain },
    { name: 'Metrics', href: '/metrics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Models', href: '/models', icon: Server },
];

export function Sidebar({ nodeId, isNetworkActive = false }: SidebarProps) {
    const pathname = usePathname();

    return (
        <div className="fixed top-0 left-0 w-64 h-screen bg-gray-800 border-r border-gray-700 flex flex-col">
            {/* Logo/Header */}
            <div className="p-6 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Network className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-white">P2P FL</h1>
                        <p className="text-gray-400 text-sm">Federated Learning</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link key={item.name} href={item.href} passHref>
                            <div
                                className={cn(
                                    "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
                                    isActive
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                <span>{item.name}</span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            {/* Node Status */}
            <div className="p-4 border-t border-gray-700">
                <div className="flex items-center space-x-3">
                    <div
                        className={cn(
                            "w-3 h-3 rounded-full",
                            isNetworkActive ? "bg-green-500 animate-pulse" : "bg-gray-500"
                        )}
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                            {isNetworkActive ? "Node Active" : "Node Inactive"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                            {nodeId ? `${nodeId.slice(0, 12)}...` : "Not connected"}
                        </p>
                    </div>
                    <Badge
                        variant={isNetworkActive ? "default" : "secondary"}
                        className="text-xs"
                    >
                        <Wifi className="h-3 w-3 mr-1" />
                        {isNetworkActive ? "Online" : "Offline"}
                    </Badge>
                </div>
            </div>
        </div>
    );
}
