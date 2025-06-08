"use client"
import { NetworkTopology } from '@/components/network-topology';
import { TrainingChart } from '@/components/training-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useWebSocket } from '@/hooks/use-websocket';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BarChart3, Brain, Download, Network, Pause, Play, RefreshCw, TrendingUp, Upload, Users, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react'

interface NetworkStats {
    connectedPeers: number;
    averageLatency: number;
    throughput: number;
    lastUpdated: string;
}

interface TrainingStatus {
    isTraining: boolean;
    currentRound: number;
    participatingPeers: string[];
    latestRound?: {
        modelAccuracy: number;
        loss: number;
        status: string;
    };
}

interface Peer {
    id: number;
    peerId: string;
    isConnected: boolean;
    lastSeen: string;
    location?: string;
    contribution: number;
}

interface NetworkActivity {
    id: number;
    type: string;
    peerId?: string;
    message: string;
    timestamp: string;
}


function Dashboard() {
    // const { toast } = useToast();
    const queryClient = useQueryClient();
    const [trainingProgress, setTrainingProgress] = useState(0);

    // WebSocket connection for real-time updates
    const { isConnected: wsConnected } = useWebSocket();

    // Queries
    const { data: networkStatus } = useQuery({
        queryKey: ['/api/network/status'],
        refetchInterval: 5000,
    });

    const { data: trainingStatus } = useQuery<TrainingStatus>({
        queryKey: ['/api/training/status'],
        refetchInterval: 2000,
    });

    const { data: peers = [] } = useQuery<Peer[]>({
        queryKey: ['/api/peers/connected'],
        refetchInterval: 3000,
    });

    const { data: networkActivity = [] } = useQuery<NetworkActivity[]>({
        queryKey: ['/api/network/activity'],
        select: (data) => data.slice(0, 10),
        refetchInterval: 5000,
    });

    const { data: trainingRounds = [] } = useQuery({
        queryKey: ['/api/training/rounds'], 
        refetchInterval: 10000,
    });


    // Mutations
    const startTrainingMutation = useMutation({
        mutationFn: () => apiRequest('POST', '/api/training/start'),
        onSuccess: () => {
            alert("Training Started")
            //   toast({
            //     title: "Training Started",
            //     description: "Federated learning training has been initiated.",
            //   });
            queryClient.invalidateQueries({ queryKey: ['/api/training/status'] });
        },
        onError: (error: any) => {
            alert("Failed to Start Training")
            //   toast({
            //     title: "Failed to Start Training",
            //     description: error.message,
            //     variant: "destructive",
            //   });
        },
    });

    const initModelMutation = useMutation({
        mutationFn: () => apiRequest('POST', '/api/model/initialize'),
        onSuccess: () => {
            alert("Model Initialized")
            //   toast({
            //     title: "Model Initialized",
            //     description: "ML model has been initialized successfully.",
            //   });
        },
        onError: (error: any) => {
            alert("Failed to Initialize Model")
            // toast({
            //     title: "Failed to Initialize Model",
            //     description: error.message,
            //     variant: "destructive",
            // });
        },
    });

    // WebSocket event handlers
    useEffect(() => {
        const handleTrainingProgress = (data: any) => {
            setTrainingProgress((data.epoch / data.totalEpochs) * 100);
        };

        const handleTrainingCompleted = () => {
            setTrainingProgress(100);
            alert("Training Complete")
            //   toast({
            //     title: "Training Completed",
            //     description: "Training round completed successfully!",
            //   });
            queryClient.invalidateQueries({ queryKey: ['/api/training/status'] });
            queryClient.invalidateQueries({ queryKey: ['/api/training/rounds'] });
        };

        const handlePeerConnected = () => {
            queryClient.invalidateQueries({ queryKey: ['/api/peers/connected'] });
            queryClient.invalidateQueries({ queryKey: ['/api/network/status'] });
        };

        const handlePeerDisconnected = () => {
            queryClient.invalidateQueries({ queryKey: ['/api/peers/connected'] });
            queryClient.invalidateQueries({ queryKey: ['/api/network/status'] });
        };

        if (wsConnected) {
            window.addEventListener('ml-training-progress', handleTrainingProgress as any);
            window.addEventListener('ml-training-completed', handleTrainingCompleted as any);
            window.addEventListener('p2p-peer-connected', handlePeerConnected as any);
            window.addEventListener('p2p-peer-disconnected', handlePeerDisconnected as any);
        }

        return () => {
            window.removeEventListener('ml-training-progress', handleTrainingProgress as any);
            window.removeEventListener('ml-training-completed', handleTrainingCompleted as any);
            window.removeEventListener('p2p-peer-connected', handlePeerConnected as any);
            window.removeEventListener('p2p-peer-disconnected', handlePeerDisconnected as any);
        };
    }, [wsConnected, queryClient]);

    const handleStartTraining = () => {
        if (!trainingStatus?.isTraining) {
            startTrainingMutation.mutate();
        }
    };

    const isTrainingActive = trainingStatus?.isTraining || false;
    const currentAccuracy = trainingStatus?.latestRound?.modelAccuracy || 0;
    const connectedPeersCount = networkStatus?.connectedPeersCount || 0;
    const averageLatency = networkStatus?.stats?.averageLatency || 0;
    const throughput = networkStatus?.stats?.throughput || 0;

    return (
        <div className="flex-1 overflow-auto p-6 bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white">P2P Federated Learning Dashboard</h2>
                    <p className="text-gray-400 mt-1">Decentralized model training network</p>
                </div>
                <div className="flex items-center space-x-4">
                    <Button
                        onClick={handleStartTraining}
                        disabled={isTrainingActive || startTrainingMutation.isPending}
                        className={`px-6 py-2 font-medium transition-colors ${isTrainingActive
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        {isTrainingActive ? (
                            <>
                                <Pause className="mr-2 h-4 w-4" />
                                Training Active
                            </>
                        ) : (
                            <>
                                <Play className="mr-2 h-4 w-4" />
                                Start Training
                            </>
                        )}
                    </Button>
                    <Badge variant={wsConnected ? "default" : "destructive"} className="px-3 py-1">
                        <div className={`w-2 h-2 rounded-full mr-2 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        {wsConnected ? 'Online' : 'Offline'}
                    </Badge>
                </div>
            </div>

            {/* Status Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Network Status Card */}
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Network Status</CardTitle>
                        <Network className="h-5 w-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-400">Connected Peers</span>
                                <span className="font-bold text-green-400">{connectedPeersCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-400">Discovery Active</span>
                                <span className="text-green-400">
                                    <Activity className="h-4 w-4" />
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Training Progress Card */}
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Training Progress</CardTitle>
                        <Brain className="h-5 w-5 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-400">
                                        Round {trainingStatus?.currentRound || 0}
                                    </span>
                                    <span>{Math.round(trainingProgress)}%</span>
                                </div>
                                <Progress value={trainingProgress} className="h-2" />
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-400">Status</span>
                                <Badge variant={isTrainingActive ? "default" : "secondary"}>
                                    {isTrainingActive ? 'Training' : 'Idle'}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Model Accuracy Card */}
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Model Accuracy</CardTitle>
                        <TrendingUp className="h-5 w-5 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="text-3xl font-bold text-green-400">
                                {(currentAccuracy * 100).toFixed(1)}%
                            </div>
                            <div className="flex items-center text-sm text-green-400">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                <span>Improving</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Network Health Card */}
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-300">Network Health</CardTitle>
                        <Zap className="h-5 w-5 text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-400">Latency</span>
                                <span className="font-bold text-green-400">{averageLatency.toFixed(0)}ms</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-400">Throughput</span>
                                <span className="font-bold text-green-400">{throughput.toFixed(1)} MB/s</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Network Topology */}
                <div className="lg:col-span-2">
                    <Card className="bg-gray-800 border-gray-700">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-xl font-semibold text-white">P2P Network Topology</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/network/status'] })}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                RefreshCw
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <NetworkTopology peers={peers} nodeId={networkStatus?.nodeId} />
                        </CardContent>
                    </Card>
                </div>

                {/* Connected Peers List */}
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-xl font-semibold text-white">Connected Peers</CardTitle>
                        <Badge variant="secondary" className="px-3 py-1">
                            {peers.length}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-80 overflow-y-auto">
                            {peers.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400">No peers connected</p>
                                    <p className="text-sm text-gray-500">Start the network to discover peers</p>
                                </div>
                            ) : (
                                peers.map((peer) => (
                                    <div key={peer.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-3 h-3 rounded-full ${peer.isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                                            <div>
                                                <p className="font-medium text-sm text-white">
                                                    {peer.peerId.slice(0, 12)}...
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {peer.location || 'Unknown location'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-green-400">
                                                {(peer.contribution * 100).toFixed(1)}%
                                            </p>
                                            <p className="text-xs text-gray-400">contribution</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Training Metrics and Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Training Metrics Chart */}
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-xl font-semibold text-white">Training Metrics</CardTitle>
                        <div className="flex space-x-2">
                            <Badge variant="default">Accuracy</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <TrainingChart data={trainingRounds} />
                    </CardContent>
                </Card>

                {/* Network Activity Log */}
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-xl font-semibold text-white">Network Activity</CardTitle>
                        <Button variant="ghost" size="sm">
                            <Activity className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-64 overflow-y-auto">
                            {networkActivity.length === 0 ? (
                                <div className="text-center py-8">
                                    <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400">No recent activity</p>
                                </div>
                            ) : (
                                networkActivity.map((activity) => (
                                    <div key={activity.id} className="flex items-start space-x-3">
                                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${activity.type === 'peer_joined' ? 'bg-green-500' :
                                                activity.type === 'peer_left' ? 'bg-red-500' :
                                                    activity.type === 'training_started' ? 'bg-blue-500' :
                                                        activity.type === 'training_completed' ? 'bg-amber-500' :
                                                            'bg-gray-500'
                                            }`} />
                                        <div className="flex-1">
                                            <p className="text-sm text-white">{activity.message}</p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(activity.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                    <CardTitle className="text-xl font-semibold text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Button
                            variant="outline"
                            className="flex items-center justify-center space-x-2 p-4 h-auto"
                            onClick={() => {
                                alert("Feature coming soon")
                                // Export model functionality
                                // toast({ title: "Feature Coming Soon", description: "Model export will be available soon." });
                            }}
                        >
                            <Download className="h-5 w-5 text-blue-500" />
                            <span>Export Model</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="flex items-center justify-center space-x-2 p-4 h-auto"
                            onClick={() => initModelMutation.mutate()}
                            disabled={initModelMutation.isPending}
                        >
                            <Upload className="h-5 w-5 text-green-500" />
                            <span>Initialize Model</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="flex items-center justify-center space-x-2 p-4 h-auto"
                            onClick={() => {
                                // View metrics functionality
                                alert("Feature coming soon")
                                // toast({ title: "Feature Coming Soon", description: "Detailed metrics view will be available soon." });
                            }}
                        >
                            <BarChart3 className="h-5 w-5 text-amber-500" />
                            <span>View Metrics</span>
                        </Button>
                        {/* <Button
                            variant="outline"
                            className="flex items-center justify-center space-x-2 p-4 h-auto"
                            onClick={() => {
                                // Network diagnostics functionality
                                toast({ title: "Feature Coming Soon", description: "Network diagnostics will be available soon." });
                            }}
                        >
                            <Stethoscope className="h-5 w-5 text-red-400" />
                            <span>Network Diagnostics</span>
                        </Button> */}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default Dashboard